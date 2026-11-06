import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from "vitest";
  
import request from "supertest";
import express from "express";
  
import { generateClaudeResponse } from "../src/providers/claudeProvider.js";
import { createUserSupabaseClient } from "../src/config/supabase.js";
import aiRoutes from "../src/routes/aiRoutes.js";
  
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
  
// Mock authentication
vi.mock("../src/middleware/requireAuth.js", () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: "test-user" };
        req.accessToken = "test-token";
        next();
    },
}));
  
// Mock Claude
vi.mock("../src/providers/claudeProvider.js", () => ({
    generateClaudeResponse: vi.fn(),
}));
  
// Mock Supabase
vi.mock("../src/config/supabase.js", () => ({
    createUserSupabaseClient: vi.fn(),
}));
  
const mockAssignment = {
    id: ASSIGNMENT_ID,
    user_id: "test-user",
    title: "Research Paper",
    course: "ENGL 101",
    duedate: futureDeadline(14),
    priority: "High",
    estimated_time: "06:00:00",
    status: "Upcoming",
    notes: "",
    is_ai_generated: false,
};
  
const mockWorkPlan = {
    workPlan: [
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
            notes: "Write the research paper.",
        },
    ],
    warnings: [],
};
  
const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);
  
app.use((error, _req, res, _next) => {
    res.status(500).json({
      error: "Unexpected server error.",
    });
});

function futureDate(daysFromNow) {
    const date = new Date();

    date.setUTCDate(date.getUTCDate() + daysFromNow);

    return date.toISOString().slice(0, 10);
}

function futureDeadline(daysFromNow) {
    return `${futureDate(daysFromNow)}T23:59:00Z`;
}
 
function mockSupabaseAssignment(assignment) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: assignment,
      error: null,
    });
  
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ select }));
  
    createUserSupabaseClient.mockReturnValue({ from });
  
    return { from, select, firstEq, secondEq, maybeSingle };
}
  
describe("AI Work Plan Endpoint", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    
        mockSupabaseAssignment(mockAssignment);
    
        generateClaudeResponse.mockResolvedValue(
            JSON.stringify(mockWorkPlan)
        );
    });
  
    it("rejects a missing assignment ID", async () => {
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({ hoursPerDay: 2 });
    
        expect(response.status).toBe(400);
        expect(generateClaudeResponse).not.toHaveBeenCalled();
    });
  
    it("rejects invalid study hours", async () => {
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: -2,
            });
    
        expect(response.status).toBe(400);
        expect(generateClaudeResponse).not.toHaveBeenCalled();
    });
  
    it("generates a valid work plan", async () => {
      const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: 2,
            });
    
        expect(response.status).toBe(200);
        expect(response.body.workPlan).toHaveLength(3);
        expect(response.body.workPlan[0].title).toBe("Research");
    
        expect(generateClaudeResponse).toHaveBeenCalledOnce();
    });
  
    it("rejects completed assignments", async () => {
        mockSupabaseAssignment({
            ...mockAssignment,
            status: "Completed",
        });
    
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: 2,
            });
    
        expect(response.status).toBe(400);
        expect(generateClaudeResponse).not.toHaveBeenCalled();
    });
  
    it("rejects malformed Claude JSON", async () => {
        generateClaudeResponse.mockResolvedValue(
            "Invalid JSON"
        );
    
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: 2,
            });
    
        expect(response.status).toBe(502);
    });
  
    it("rejects study sessions exceeding daily hours", async () => {
        generateClaudeResponse.mockResolvedValue(
            JSON.stringify({
            workPlan: [
                {
                title: "Research",
                scheduled_date: futureDate(2),
                estimated_time: 4,
                notes: "Research sources.",
                },
            ],
            warnings: [],
            })
        ); 
    
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: 2,
            });
    
        expect(response.status).toBe(502);
    });
  
    it("rejects assignments belonging to another user", async () => {
        mockSupabaseAssignment(null);
    
        const response = await request(app)
            .post("/api/ai/work-plan")
            .send({
            assignmentId: ASSIGNMENT_ID,
            hoursPerDay: 2,
            });
    
        expect(response.status).toBe(404);
        expect(generateClaudeResponse).not.toHaveBeenCalled();
    });
});

  