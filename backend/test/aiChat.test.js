
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import { generateClaudeResponse } from "../src/providers/claudeProvider.js";
import { requireAuth } from "../src/middleware/requireAuth.js";
import aiRoutes from "../src/routes/aiRoutes.js";

vi.mock("../src/providers/claudeProvider.js", () => ({
  generateClaudeResponse: vi.fn(),
}));

vi.mock("../src/middleware/requireAuth.js", () => ({
  requireAuth: vi.fn((req, res, next) => {
    req.user = { id: "test-user-123" };
    next();
  }),
}));

const app = express();

app.use(express.json());
app.use("/api/ai", aiRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: "Unexpected server error.",
  });
});

beforeEach(() => {
  vi.resetAllMocks();

  requireAuth.mockImplementation((req, res, next) => {
    req.user = { id: "test-user-123" };
    next();
  });
});

describe("Dashboard AI Study Chat", () => {
  it("returns a Claude response for a valid question", async () => {
    generateClaudeResponse.mockResolvedValue(
      "Binary search repeatedly divides a sorted array in half."
    );

    const response = await request(app)
      .post("/api/ai/chat")
      .send({
        message: "Explain binary search.",
        history: [],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reply: "Binary search repeatedly divides a sorted array in half.",
    });

    expect(generateClaudeResponse).toHaveBeenCalledOnce();
    expect(generateClaudeResponse).toHaveBeenCalledWith(
      expect.stringContaining("Explain binary search."),
      1500
    );
  });

  it("rejects an empty question", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "   " });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects questions longer than 4000 characters", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "a".repeat(4001) });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects invalid conversation history", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({
        message: "Explain recursion.",
        history: [{ role: "admin", content: "Invalid role" }],
      });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects history longer than 12 messages", async () => {
    const history = Array.from({ length: 13 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index}`,
    }));

    const response = await request(app)
      .post("/api/ai/chat")
      .send({
        message: "Continue explaining.",
        history,
      });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("includes previous conversation context", async () => {
    generateClaudeResponse.mockResolvedValue(
      "Here is a binary search example."
    );

    const response = await request(app)
      .post("/api/ai/chat")
      .send({
        message: "Give me an example.",
        history: [
          { role: "user", content: "Explain binary search." },
          { role: "assistant", content: "Binary search uses sorted data." },
        ],
      });

    expect(response.status).toBe(200);

    const prompt = generateClaudeResponse.mock.calls[0][0];

    expect(prompt).toContain("Explain binary search.");
    expect(prompt).toContain("Binary search uses sorted data.");
    expect(prompt).toContain("Give me an example.");
  });

  it("rejects unauthenticated requests", async () => {
    requireAuth.mockImplementationOnce((_req, res) => {
      res.status(401).json({
        error: "Authentication required.",
      });
    });

    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "Explain binary search." });

    expect(response.status).toBe(401);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("handles Claude provider failures", async () => {
    generateClaudeResponse.mockRejectedValue(
      new Error("Claude unavailable")
    );

    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "Explain binary search." });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected server error.",
    });
  });

  it("rejects empty Claude responses", async () => {
    generateClaudeResponse.mockResolvedValue("   ");

    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "Explain binary search." });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe(
      "The study assistant returned an empty response."
    );
  });
});
