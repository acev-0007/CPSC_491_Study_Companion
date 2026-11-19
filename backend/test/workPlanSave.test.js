import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
} from "vitest";

import express from "express";
import request from "supertest";

import {
    createUserSupabaseClient,
} from "../src/config/supabase.js";

import assignmentRoutes from "../src/routes/assignmentRoutes.js";

// Mock authentication
vi.mock("../src/middleware/requireAuth.js", () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: "test-user" };
        req.accessToken = "test-token";
        next();
    },
}));

// Mock Supabase
vi.mock("../src/config/supabase.js", () => ({
    createUserSupabaseClient: vi.fn(),
}));

const ASSIGNMENT_ID =
    "550e8400-e29b-41d4-a716-446655440000";

function futureDate(daysFromNow) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    return date.toISOString().slice(0, 10);
}

const mockAssignment = {
    id: ASSIGNMENT_ID,
    user_id: "test-user",
    title: "Research Paper",
    course: "ENGL 101",
    duedate: `${futureDate(14)}T23:59:00Z`,
    priority: "High",
    status: "Upcoming",
    estimated_time: "06:00:00",
    is_ai_generated: false,
};

function makeWorkPlan() {
    return [
        {
            title: "Research",
            scheduled_date: futureDate(2),
            estimated_time: 2,
            notes: "Find research sources.",
        },
        {
            title: "Outline",
            scheduled_date: futureDate(3),
            estimated_time: 2,
            notes: "Create an outline.",
        },
        {
            title: "Writing",
            scheduled_date: futureDate(4),
            estimated_time: 2,
            notes: "Write the paper.",
        },
    ];
}

// Mock database responses
const database = vi.hoisted(() => ({
    assignment: null,
    existingTasks: [],
    insertedTasks: [],
    fetchError: null,
    duplicateError: null,
    saveError: null,
}));

function createMockSupabase() {
    return {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                            data: database.assignment,
                            error: database.fetchError,
                        })),
                        limit: vi.fn(async () => ({
                            data: database.existingTasks,
                            error: database.duplicateError,
                        })),
                    })),
                })),
            })),
            insert: vi.fn((records) => {
                database.insertedTasks = records;

                return {
                    select: vi.fn(async () => ({
                        data: database.saveError
                            ? null
                            : records.map((record, index) => ({
                                ...record,
                                id: `generated-${index + 1}`,
                                estimated_time: "02:00:00",
                            })),
                        error: database.saveError,
                    })),
                };
            }),
        })),
    };
}

const app = express();
app.use(express.json());
app.use("/api/assignments", assignmentRoutes);

app.use((error, _req, res, _next) => {
    res.status(500).json({
        error: "Unexpected server error.",
    });
});

describe("AI Work Plan Save Endpoint", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        database.assignment = {
            ...mockAssignment,
            duedate: `${futureDate(14)}T23:59:00Z`,
        };

        database.existingTasks = [];
        database.insertedTasks = [];
        database.fetchError = null;
        database.duplicateError = null;
        database.saveError = null;

        createUserSupabaseClient.mockReturnValue(
            createMockSupabase()
        );
    });

    it("saves a valid work plan", async () => {
        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(201);
        expect(response.body.assignments).toHaveLength(3);
        expect(database.insertedTasks).toHaveLength(3);

        expect(database.insertedTasks[0]).toMatchObject({
            user_id: "test-user",
            is_ai_generated: true,
            parent_assignment_id: ASSIGNMENT_ID,
            course: "ENGL 101",
            priority: "High",
        });
    });

    it("rejects a missing assignment ID", async () => {
        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(400);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("rejects an empty work plan", async () => {
        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: [],
            });

        expect(response.status).toBe(400);
    });

    it("rejects invalid study durations", async () => {
        const workPlan = makeWorkPlan();
        workPlan[0].estimated_time = -2;

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan,
            });

        expect(response.status).toBe(400);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("rejects invalid scheduled dates", async () => {
        const workPlan = makeWorkPlan();
        workPlan[0].scheduled_date = "not-a-date";

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan,
            });

        expect(response.status).toBe(400);
    });

    it("rejects completed assignments", async () => {
        database.assignment.status = "Completed";

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(400);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("rejects inaccessible assignments", async () => {
        database.assignment = null;

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(404);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("rejects duplicate work plans", async () => {
        database.existingTasks = [{ id: "existing-task" }];

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(409);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("handles Supabase insert failures", async () => {
        database.saveError = {
            message: "Database insert failed",
        };

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan: makeWorkPlan(),
            });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe(
            "Failed to save AI work plan."
        );
    });

    it("rejects work plans with incorrect total hours", async () => {
        const workPlan = makeWorkPlan();
        workPlan[0].estimated_time = 1;

        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
                assignmentId: ASSIGNMENT_ID,
                workPlan,
            });

        expect(response.status).toBe(400);
        expect(database.insertedTasks).toHaveLength(0);
    });

    it("rejects an invalid timezone when saving", async () => {
        const response = await request(app)
            .post("/api/assignments/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            workPlan: makeWorkPlan(),
            timeZone: "Invalid/Timezone",
            });

        expect(response.status).toBe(400);
        expect(database.insertedTasks).toHaveLength(0);
    });
});
