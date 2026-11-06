import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
} from "vitest";

import request from "supertest";
import { randomUUID } from "node:crypto";

// Mock authentication before importing the app
vi.mock("../src/middleware/requireAuth.js", () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: "test-user" };
        req.accessToken = "test-token";
        next();
    },
}));

// Isolated test database
const mockDatabase = vi.hoisted(() => ({
    assignments: [],
}));

vi.mock("../src/config/supabase.js", async (importOriginal) => {
    const original = await importOriginal();

    return {
        ...original,
        createUserSupabaseClient: () => ({
            from: () => {
                let filters = {};
                let operation = "select";
                let payload = null;
                let single = false;

                const query = {
                    select() {
                        return query;
                    },

                    eq(field, value) {
                        filters[field] = value;
                        return query;
                    },

                    order() {
                        return query;
                    },

                    maybeSingle() {
                        single = true;
                        return execute();
                    },

                    insert(data) {
                        operation = "insert";
                        payload = data;
                        return query;
                    },

                    update(data) {
                        operation = "update";
                        payload = data;
                        return query;
                    },

                    delete() {
                        operation = "delete";
                        return query;
                    },

                    then(resolve, reject) {
                        return execute().then(resolve, reject);
                    },
                };

                async function execute() {
                    const matches = (assignment) =>
                        Object.entries(filters).every(
                            ([field, value]) =>
                                assignment[field] === value
                        );

                    if (operation === "insert") {
                        const records = (
                            Array.isArray(payload)
                                ? payload
                                : [payload]
                        ).map((record) => ({
                            id: randomUUID(),
                            ...record,
                            estimated_time:
                                record.estimated_time,
                        }));

                        mockDatabase.assignments.push(...records);

                        return {
                            data: records,
                            error: null,
                        };
                    }

                    if (operation === "update") {
                        const records =
                            mockDatabase.assignments.filter(matches);

                        records.forEach((record) => {
                            Object.assign(record, payload);
                        });

                        return {
                            data: single
                                ? records[0] ?? null
                                : records,
                            error: null,
                        };
                    }

                    if (operation === "delete") {
                        const records =
                            mockDatabase.assignments.filter(matches);

                        mockDatabase.assignments =
                            mockDatabase.assignments.filter(
                                (record) => !matches(record)
                            );

                        return {
                            data: records,
                            error: null,
                        };
                    }

                    const records =
                        mockDatabase.assignments.filter(matches);

                    return {
                        data: single
                            ? records[0] ?? null
                            : records,
                        error: null,
                    };
                }

                return query;
            },
        }),
    };
});

import { createApp } from "../src/app.js";

const app = createApp();

const API = "/api/assignments";

const validAssignment = {
    title: "Test Assignment",
    course: "CPSC491",
    duedate: "2026-12-15T12:00:00Z",
    estimated_time: 2,
    priority: "High",
    status: "Upcoming",
    notes: "Automated API test",
};

describe("Assignment API Tests", () => {
    beforeEach(() => {
        mockDatabase.assignments = [];
    });

    it("creates an assignment with valid data", async () => {
        const response = await request(app)
            .post(API)
            .send(validAssignment);

        expect(response.status).toBe(201);
        expect(response.body.title).toBe("Test Assignment");
        expect(response.body.course).toBe("CPSC491");
        expect(response.body.priority).toBe("High");
        expect(response.body.status).toBe("Upcoming");
        expect(response.body.id).toBeDefined();
    });

    it("retrieves a created assignment", async () => {
        const created = await request(app)
            .post(API)
            .send(validAssignment);

        const response = await request(app)
            .get(`${API}/${created.body.id}`);

        expect(response.status).toBe(200);
        expect(response.body.title).toBe(validAssignment.title);
        expect(response.body.course).toBe(validAssignment.course);
        expect(response.body.priority).toBe(validAssignment.priority);
    });

    it("updates assignment priority using PUT", async () => {
        const created = await request(app)
            .post(API)
            .send(validAssignment);

        const response = await request(app)
            .put(`${API}/${created.body.id}`)
            .send({ priority: "Low" });

        expect(response.status).toBe(200);
        expect(response.body.priority).toBe("Low");

        const retrieved = await request(app)
            .get(`${API}/${created.body.id}`);

        expect(retrieved.status).toBe(200);
        expect(retrieved.body.priority).toBe("Low");
    });

    it("updates assignment status using PATCH", async () => {
        const created = await request(app)
            .post(API)
            .send(validAssignment);

        const response = await request(app)
            .patch(`${API}/${created.body.id}`)
            .send({ status: "In Progress" });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("In Progress");
    });

    it("deletes an assignment successfully", async () => {
        const created = await request(app)
            .post(API)
            .send(validAssignment);

        const response = await request(app)
            .delete(`${API}/${created.body.id}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Assignment deleted");

        const retrieved = await request(app)
            .get(`${API}/${created.body.id}`);

        expect(retrieved.status).toBe(404);
        expect(retrieved.body.error).toBe("Assignment not found");
    });

    it("rejects missing required fields", async () => {
        const response = await request(app)
            .post(API)
            .send({
                title: "",
                course: "",
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Title can't be empty");
    });

    it("rejects an invalid priority", async () => {
        const response = await request(app)
            .post(API)
            .send({
                ...validAssignment,
                priority: "Urgent",
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Priority must be");
    });

    it("rejects an invalid status", async () => {
        const response = await request(app)
            .post(API)
            .send({
                ...validAssignment,
                status: "Invalid",
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Status must be");
    });

    it("returns 404 for a nonexistent assignment", async () => {
        const response = await request(app)
            .get(`${API}/${randomUUID()}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Assignment not found");
    });

    it("keeps test assignments isolated", async () => {
        const response = await request(app)
            .get(API);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
});
