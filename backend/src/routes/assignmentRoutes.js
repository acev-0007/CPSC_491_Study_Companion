import express from "express";

import {
    requireAuth
} from "../middleware/requireAuth.js"

import {
    createUserSupabaseClient
} from "../config/supabase.js"
import { time } from "node:console";
import { getDateInTimeZone } from "../utils/dateUtils.js"
import { type } from "node:os";


const router = express.Router();

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUS = ['Upcoming', 'In Progress', 'Completed'];


function intervalToHours(interval) {
    if (interval == null) return null;

    const match = String(interval).match(
        /^(-)?(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/
    );

    if (!match) return null;

    const sign = match[1] ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3]);
    const seconds = Number(match[4]);

    return sign * (hours + minutes / 60 + seconds / 3600);
}

function formatAssignment(assignment) {
    return {
        ...assignment,
        estimated_time: intervalToHours(assignment.estimated_time)
    };
}

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

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`});
    }
    if (status !== undefined && !VALID_STATUS.includes(status)) {
        return res.status(400).json({error: `Status must be one of: ${VALID_STATUS.join(', ')}`});
    }

    next();
};


// ===== CRUD ENDPOINTS =====

// READ ALL (GET) - Retrieve assignments sorted by due date
router.get('/', requireAuth, async (req, res) => {
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

        res.status(200).json(data.map(formatAssignment));
    } catch (error) {
        console.error("Error fetching assignments: ", error);
        res.status(500).json({
            error: "Failed to fetch assignments"
        });
    }
});

// READ ONE (GET by ID)
router.get('/:id', requireAuth, async (req, res) => {
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

        res.status(200).json(formatAssignment(data));
    } catch (error) {
        console.error("Error fetching assignments: ", error);
        res.status(500).json({
            error: "Failed to fetch assignments"
        });
    }
});

router.patch("/:id", requireAuth, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !VALID_STATUS.includes(status)) {
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

        res.status(200).json(formatAssignment(data));

    } catch (error) {
        console.error("Error updating assignment status: ", error);
        res.status(500).json({error: "Failed to update assignment"});
    }
});

// CREATE (POST) - Creates assignments
router.post('/', requireAuth, validateAssignmentInput, async (req, res) => {
    try {
        const supabase = createUserSupabaseClient(req.accessToken);

        const newAssignment = {
            user_id: req.user.id,
            title: req.body.title.trim(),
            course: req.body.course.trim(),
            duedate: new Date(req.body.duedate).toISOString(),
            estimated_time: `${Number(req.body.estimated_time)} hours`,
            priority: req.body.priority || "Low",
            status: req.body.status || "Upcoming",
            notes: req.body.notes || ""
        };
        
        const { data, error } = await supabase
            .from('assignments')
            .insert(newAssignment)
            .select();
        
        if (error) {
            throw error;
        }

        res.status(201).json(formatAssignment(data[0]));
    } catch (error) {
        console.error("Error creating assignment: ", error);
        res.status(500).json({error: "Failed to create assignment"});
    }
});

// UPDATE (PUT) - Update assignments
router.put('/:id', requireAuth, validateAssignmentInput, async (req, res) => {
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
            updates.estimated_time = `${Number(updates.estimated_time)}`;
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

        res.status(200).json(formatAssignment(data[0]));

    } catch (error) {
        console.error("Error updating assignments: ", error);
        res.status(500).json({
            error: "Failed to update assignments"
        });
    }
});

// DELETE (DELETE) - Delete assignments
router.delete('/:id', requireAuth, async (req, res) => {
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

// === For AI ===
const WORK_PLAN_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidWorkPlanDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

// CREATE AI-generated assignment tasks
router.post("/work-plan", requireAuth, async (req, res) => {
    try {
        const { 
            assignmentId, 
            workPlan,
            timeZone = "UTC",
        } = req.body ?? {};

        // validate the request
        if (
            typeof assignmentId !== "string" ||
            !WORK_PLAN_UUID_PATTERN.test(assignmentId)
        ) {
            return res.status(400).json({
                error: "A valid assignment ID is required.",
            });
        }

        if (typeof timeZone !== "string") {
            return res.status(400).json({
                error: "Invalid timezone",
            });
        }

        try {
            new Intl.DateTimeFormat("en-US", { timeZone });
        } catch {
            return res.status(400).json({
                error: "Invalid timezone",
            });
        }

        const MAX_WORK_PLAN_SESSIONS = 30;

        if (
            !Array.isArray(workPlan) ||
            workPlan.length === 0 ||
            workPlan.length > MAX_WORK_PLAN_SESSIONS
        ) {
            return res.status(400).json({
                error: "Work plan must contain 1 to 30 tasks.",
            });
        }

        // retrieve the original assignment
        const supabase = createUserSupabaseClient(req.accessToken);

        const { data: assignment, error: fetchError } =
            await supabase
                .from("assignments")
                .select("*")
                .eq("id", assignmentId)
                .eq("user_id", req.user.id)
                .maybeSingle();

        if (fetchError) {
            throw fetchError;
        }

        if (!assignment) {
            return res.status(404).json({
                error: "Original assignment not found.",
            });
        }

        if (
            assignment.status === "Completed" ||
            assignment.is_ai_generated
        ) {
            return res.status(400).json({
                error: "Cannot create a work plan for this assignment.",
            });
        }

        // const today = getDateInTimeZone(new Date(), timeZone);

        // const deadline = getDateInTimeZone(deadline, timeZone);

        // if (Number.isNaN(deadline.getTime())) {
        //     return res.status(400).json({
        //         error: "Original assignment has an invalid deadline.",
        //     });
        // }

        // const dueDate = deadline.toISOString().slice(0, 10);

        // if (deadline.getTime() <= Date.now()) {
        //     return res.status(400).json({
        //         error: "Original assignment deadline has passed.",
        //     });
        // }
        // Get the original assignment deadline first
        const deadline = new Date(assignment.duedate);

        // Validate the deadline
        if (Number.isNaN(deadline.getTime())) {
            return res.status(400).json({
                error: "Original assignment has an invalid deadline.",
            });
        }

        // Calculate dates using the user's timezone
        const today = getDateInTimeZone(new Date(), timeZone);
        const dueDate = getDateInTimeZone(deadline, timeZone);

        // Check whether the original deadline has passed
        if (deadline.getTime() <= Date.now()) {
            return res.status(400).json({
                error: "Original assignment deadline has passed.",
            });
        }

        // validate every generated task
        for (const task of workPlan) {
            if (
                !task ||
                typeof task.title !== "string" ||
                !task.title.trim() ||
                task.title.trim().length > 255 ||
                typeof task.notes !== "string" ||
                !isValidWorkPlanDate(task.scheduled_date) ||
                task.scheduled_date < today ||
                task.scheduled_date > dueDate ||
                typeof task.estimated_time !== "number" ||
                !Number.isFinite(task.estimated_time) ||
                task.estimated_time <= 0 ||
                task.estimated_time > 24
            ) {
                return res.status(400).json({
                    error: "Work plan contains invalid study tasks.",
                });
            }
        }

        // check the total study duration
        const originalHours = intervalToHours(
            assignment.estimated_time
        );

        const totalHours = workPlan.reduce(
            (sum, task) => sum + task.estimated_time,
            0
        );

        if (
            originalHours === null ||
            !Number.isFinite(originalHours) ||
            originalHours <= 0 ||
            Math.abs(totalHours - originalHours) > 0.01
        ) {
            return res.status(400).json({
                error: "Work plan duration does not match the assignment.",
            });
        }

        // prevent duplicate work plans
        const { data: existingTasks, error: duplicateError } =
            await supabase
                .from("assignments")
                .select("id")
                .eq("user_id", req.user.id)
                .eq("parent_assignment_id", assignmentId)
                .limit(1);

        if (duplicateError) {
            throw duplicateError;
        }

        if (existingTasks?.length) {
            return res.status(409).json({
                error: "A work plan already exists for this assignment.",
            });
        }

        // prepare database records
        const newTasks = workPlan.map((task) => ({
            user_id: req.user.id,
            title: task.title.trim(),
            course: assignment.course,
            duedate: assignment.duedate,
            priority: assignment.priority,
            status: "Upcoming",
            notes: task.notes.trim(),
            estimated_time: `${task.estimated_time} hours`,
            is_ai_generated: true,
            parent_assignment_id: assignment.id,
            scheduled_date: task.scheduled_date,
        }));

        // save generated tasks
        const { data: savedTasks, error: saveError } =
            await supabase
                .from("assignments")
                .insert(newTasks)
                .select();

        if (saveError) {
            throw saveError;
        }

        // return saved assignments
        return res.status(201).json({
            message: "AI work plan saved successfully.",
            assignments: savedTasks.map(formatAssignment),
        });

    } catch (error) {
        console.error("Error saving AI work plan:", error);

        return res.status(500).json({
            error: "Failed to save AI work plan.",
        });
    }
});


export default router;