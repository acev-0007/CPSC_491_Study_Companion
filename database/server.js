// ===== IMPORTS AND APP CONFIG =====
const express = require('express');
const app = express();
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // Generates unique UUID strings

app.use(cors());
app.use(express.json());

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUS = ['Upcoming', 'In Progress', 'Completed', 'Overdue'];

// Temp in-memory test data
let assignments = [
    {
        id: "1",
        title: "Sprint 1",
        course: "CPSC491",
        duedate: "2026-09-25",
        estimated_time: 2,
        priority: "Low",
        status: "Upcoming",
        notes: ""
    }
];

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
        return res.status(400).json({error: "Priority must be one of: ${VALID_PRIORITIES.join(', ')}"});
    }
    if (status && !VALID_STATUS.includes(status)) {
        return res.status(400).json({error: "Priority must be one of: ${VALID_STATUS.join(', ')}"});
    }

    next();
};


// ===== CRUD ENDPOINTS =====

// READ ALL (GET) - Retrieve assignments sorted by due date
app.get('/api/assignments', (req, res) => {
    const sorted = [...assignments].sort((a, b) => new Date(a.duedate) - new Date(b.duedate));
    res.status(200).json(sorted);
});

// READ ONE (GET by ID)
app.get('api/assignments/:id', (req, res) => {
    const assignments = assignments.find(a => a.id === req.paramas.id);
    if (!assignments) {
        return res.status(404).json({error: "Assignment not found"});
    }
    res.status(200).json(assignments);
});

// CREATE (POST) - Creates assignments
app.post('/api/assignments', validateAssignmentInput, (req, res) => {
    const newAssignment = {
        id: uuidv4(),
        user_id: req.body.user_id || "user_123",
        title: req.body.title.trim(),
        course: req.body.course.trim(),
        duedate: new Date(req.body.duedate).toISOString(),
        estimated_time: req.body.estimated_time,
        priority: req.body.priority || "Low",
        status: "Upcoming", // Enforce initial state run
        notes: req.body.notes || ""
    };
    assignments.push(newAssignment);
    res.status(202).json(newAssignment);
});

// UPDATE (PUT) - Update assignments
app.put('/api/assignments/:id', validateAssignmentInput, (req, res) => {
    const index = assignments.findIndex(a => a.id === req.parama.id);
    if (index === -1) {
        return res.status(404).json({error: "Assignment Not Found"});
    }

    assignments[index] = {
        ...assignments[index],
        ...req.body
    };
    res.status(200).json(assignments[index]);
});

// DELETE (DELETE) - Delete assignments
app.delete('/api/assignments/:id', (req, res) => {
    const initialLength = assignments.length;
    assignments = assignments.filter(a => a.id !== req.parama.id);

    if (assignments.length === initialLength) {
        return res.status(404).json({error: "Assignment Not Found"});
    }
    res.status(200).json({error: "Assignment deleted"});
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log('Server running on port ${PORT}');
});