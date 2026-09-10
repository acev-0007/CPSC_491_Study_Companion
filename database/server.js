// ===== IMPORTS AND APP CONFIG =====
const express = require('express');
const app = express();
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // Generates unique UUID strings

app.use(cors());
app.use(express.json());

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUS = ['Upcoming', 'In Progress', 'Completed', 'Overdue'];

// Temp in-memory database/storage
let assignments = [
    {
        id: "1",
    }
];

// Check input validation
const validateAssignmentInput = (req, res, next) => {
    const {title, course, duedate, priority, status} = req.body;

    if (req.method === 'POST') {
        if(!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json(console.error("Title is required"));
        }
        if(!duedate || isNaN(Date.parse(duedate))) {
            return res.status(400).json(console.error("Valid due date is required"))
        }
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json(console.error("Priority must be one of: ${VALID_PRIORITIES.join(', ')}"));
    }
};


// ===== CRUD ENDPOINTS =====

// READ ALL (GET) - Retrieve assignments sorted by due date

// READ ONE (GET by ID)

// CREATE (POST) - Creates assignments

// UPDATE (PUT) - Update assignments

// DELETE (DELETE) - Delete assignments