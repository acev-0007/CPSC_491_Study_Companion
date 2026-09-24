// ===== IMPORTS AND APP CONFIG =====
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supavase-js')

const app = express();

app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUS = ['Upcoming', 'In Progress', 'Completed', 'Overdue'];

// Check input validation
const validateAssignmentInput = (req, res, next) => {
    const {title, course, duedate, estimated_time, priority, status} = req.body;

    if (req.method === 'POST') {
        if(!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({error: "Title is required"});
        }
        if(!course || typeof course !== 'string' || course.trim() === '') {
            return res.status(400).json({error: "Course is required"});
        }
        if(!duedate || isNaN(Date.parse(duedate))) {
            return res.status(400).json({error: " Valid due date is required"});
        }
        if(!estimated_time) {
            return res.status(400).json({error: "Valid estimated time is required"});
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
app.get('/api/assignments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
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
app.get('/api/assignments/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) {
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

// CREATE (POST) - Creates assignments
app.post('/api/assignments', validateAssignmentInput, async (req, res) => {
    try {
        const newAssignment = {
            user_id: req.body.user_id || "user_123",
            title: req.body.title.trim(),
            course: req.body.course.trim(),
            duedate: new Date(req.body.duedate).toISOString(),
            estimated_time: req.body.estimated_time,
            priority: req.body.priority || "Low",
            status: "Upcoming", // Enforce initial state run
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
app.put('/api/assignments/:id', validateAssignmentInput, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .update(req.body)
            .eq('id', req.params.id)
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
app.delete('/api/assignments/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', req.params.id);
        
        if (error) {
            throw error;
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
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});