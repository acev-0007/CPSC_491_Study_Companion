// ===== IMPORTS AND APP CONFIG =====
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { 
    requireAuth,
} from '../backend/src/middleware/requireAuth.js';

import {
    createUserSupabaseClient,
} from "../backend/src/config/supabase.js";

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUS = ['Upcoming', 'In Progress', 'Completed'];

// Check input validation
const validateAssignmentInput = (req, res, next) => {
    const {title, course, duedate, estimated_time, priority, status} = req.body;

    if (req.method === 'POST') {
        if(!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({error: "Title can't be empty"});
        }


        if(!course || typeof course !== 'string' || course.trim() === '') {
            return res.status(400).json({error: "Course can't be empty"});
        }


        if(!duedate || isNaN(Date.parse(duedate))) {
            return res.status(400).json({error: "Valid due date is required"});
        }

        if(
            estimated_time === undefined ||
            estimated_time === null ||
            isNaN(Number(estimated_time)) ||
            Number(estimated_time) <= 0
        ) {
            return res.status(400).json({error: "Estimated time must be a positive number"});
        }
    }

    if (req.method === 'PUT') {
        if(title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
            return res.status(400).json({error: "Title is required"});
        }


        if(course !== undefined && (typeof course !== 'string' || course.trim() === '')) {
            return res.status(400).json({error: "Course is required"});
        }


        if(duedate !== undefined && isNaN(Date.parse(duedate))) {
            return res.status(400).json({error: "Valid due date is required"});
        }

        if(
            estimated_time !== undefined &&
            (
                isNaN(Number(estimated_time)) ||
                Number(estimated_time) <= 0
            )
        ) {
            return res.status(400).json({error: "Estimated time must be a positive number"});
        }
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`});
    }
    if (status && !VALID_STATUS.includes(status)) {
        return res.status(400).json({error: `Status must be one of: ${VALID_STATUS.join(', ')}`});
    }

    next();
};


// ===== CRUD ENDPOINTS =====

// READ ALL (GET) - Retrieve assignments sorted by due date
app.get('/api/assignments', requireAuth, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('user_id', req.user.id)
            .order('duedate', { ascending: true});
        
        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching assignments: ", error);
        res.status(500).json({
            error: "Failed to fetch assignments"
        });
    }
});

// READ ONE (GET by ID)
app.get('/api/assignments/:id', requireAuth, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();
        
        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({error: "Assignment not found"});
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching assignments: ", error);
        res.status(500).json({
            error: "Failed to fetch assignments"
        });
    }
});

app.patch("/api/assignments/:id", requireAuth, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);
        const { id } = req.params;
        const { status } = req.body;

        if (!status && !VALID_STATUS.includes(status)) {
            return res.status(400).json({ error: "Invalid assignment status" });
        }

        const { data, error } = await supabase
            .from("assignments")
            .update({
                status: status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("user_id", req.user.id)
            .select()
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({error: "Assignment not found"});
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Error updating assignment status: ", error);
        res.status(500).json({error: "Failed to update assignment"});
    }
});

// CREATE (POST) - Creates assignments
app.post('/api/assignments', requireAuth, validateAssignmentInput, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        const newAssignment = {
            user_id: req.user.id,
            title: req.body.title.trim(),
            course: req.body.course.trim(),
            duedate: new Date(req.body.duedate).toISOString(),
            estimated_time: Number(req.body.estimated_time),
            priority: req.body.priority || "",
            status: req.body.status || "",
            notes: req.body.notes || ""
        };
        
        const { data, error } = await supabase
            .from('assignments')
            .insert(newAssignment)
            .select();
        
        if (error) {
            throw error;
        }

        res.status(201).json(data[0]);
    } catch (error) {
        console.error("Error creating assignment: ", error);
        res.status(500).json({error: "Failed to create assignment"});
    }
});

// UPDATE (PUT) - Update assignments
app.put('/api/assignments/:id', requireAuth, validateAssignmentInput, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        // Only allow these fields to be updated
        const allowedFields = [
            'title',
            'course',
            'duedate',
            'estimated_time',
            'priority',
            'status',
            'notes'

        ];

        const updates = {};

        // Check which allowed fields were sent in the request
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({error: "No valid fields provided for update"});
        }

        // Clean values before sending to Supabase
        if (updates.title !== undefined) {
            updates.title = updates.title.trim();
        }

        if (updates.course !== undefined) {
            updates.course = updates.course.trim();
        }

        if (updates.duedate !== undefined) {
            updates.duedate = new Date(updates.duedate).toISOString();
        }

        if (updates.estimated_time !== undefined) {
            updates.estimated_time = Number(updates.estimated_time);
        }

        updates.updated_at = new Date().toISOString();

        // Send only approved fields to Supabase
        const { data, error } = await supabase
            .from('assignments')
            .update(updates)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select();
        
        if (error) {
            throw(error);
        }
        if (!data || data.length === 0) {
            return res.status(404).json({error: "Assignment not found"});
        }

        res.status(200).json(data[0]);

    } catch (error) {
        console.error("Error updating assignments: ", error);
        res.status(500).json({
            error: "Failed to update assignments"
        });
    }
});

// DELETE (DELETE) - Delete assignments
app.delete('/api/assignments/:id', requireAuth, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        const { data, error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select();
        
        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            return res.status(404).json({error: "Assignment not found"});
        }

        res.status(200).json({message: "Assignment deleted"});

    } catch (error) {
        console.error("Error deleting assignments: ", error);
        res.status(500).json({
            error: "Failed to delete assignments"
        });
    }
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});