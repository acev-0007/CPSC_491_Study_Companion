
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

import { generateClaudeResponse } from "../src/providers/claudeProvider.js";
import aiRoutes from "../src/routes/aiRoutes.js";

// Mock Claude so tests never call the real API.
vi.mock("../src/providers/claudeProvider.js", () => ({
  generateClaudeResponse: vi.fn(),
}));

// Isolated Express application for testing AI routes.
const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);

// Match the application's generic error response.
app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: "Unexpected server error.",
  });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SCRUM-245: Generic AI validation", () => {
  it("rejects a missing prompt", async () => {
    const response = await request(app)
      .post("/api/ai/generate")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "A prompt is required.",
    });
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only prompts", async () => {
    const response = await request(app)
      .post("/api/ai/generate")
      .send({ prompt: "   " });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("returns a valid AI response", async () => {
    generateClaudeResponse.mockResolvedValue(
      "Object-oriented programming uses objects."
    );

    const response = await request(app)
      .post("/api/ai/generate")
      .send({ prompt: "Explain OOP." });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      response: "Object-oriented programming uses objects.",
    });
  });
});

describe("SCRUM-245: Summarization validation", () => {
  it("rejects missing study material", async () => {
    const response = await request(app)
      .post("/api/ai/summarize")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Study material is required."
    );
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only study material", async () => {
    const response = await request(app)
      .post("/api/ai/summarize")
      .send({ notes: "   " });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects non-string study material", async () => {
    const response = await request(app)
      .post("/api/ai/summarize")
      .send({ notes: 123 });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("generates a summary for valid notes", async () => {
    generateClaudeResponse.mockResolvedValue(
      "Encapsulation protects internal object state."
    );

    const response = await request(app)
      .post("/api/ai/summarize")
      .send({
        notes: "Encapsulation hides internal state.",
      });

    expect(response.status).toBe(200);
    expect(response.body.summary).toBe(
      "Encapsulation protects internal object state."
    );
    expect(generateClaudeResponse).toHaveBeenCalledOnce();
  });
});

describe("SCRUM-245: Flashcards validation", () => {
  it("rejects missing notes", async () => {
    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({});

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only notes", async () => {
    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: "   " });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("rejects non-string notes", async () => {
    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: 42 });

    expect(response.status).toBe(400);
    expect(generateClaudeResponse).not.toHaveBeenCalled();
  });

  it("returns structured flashcards", async () => {
    generateClaudeResponse.mockResolvedValue(
      JSON.stringify({
        flashcards: [
          {
            front: "What is encapsulation?",
            back: "Hiding internal object state.",
          },
        ],
      })
    );

    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({
        notes: "Encapsulation hides internal state.",
      });

    expect(response.status).toBe(200);
    expect(response.body.flashcards).toEqual([
      {
        front: "What is encapsulation?",
        back: "Hiding internal object state.",
      },
    ]);
  });

  it("rejects malformed Claude JSON", async () => {
    generateClaudeResponse.mockResolvedValue(
      "Not valid JSON"
    );

    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: "Study notes." });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: "Flashcard generation failed.",
    });
  });

  it("rejects flashcards missing required fields", async () => {
    generateClaudeResponse.mockResolvedValue(
      JSON.stringify({
        flashcards: [
          { front: "Question without an answer" },
        ],
      })
    );

    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: "Study notes." });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe(
      "Flashcard generation failed."
    );
  });

  it("rejects empty flashcard arrays", async () => {
    generateClaudeResponse.mockResolvedValue(
      JSON.stringify({ flashcards: [] })
    );

    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: "Study notes." });

    expect(response.status).toBe(502);
  });
});

describe("SCRUM-245: AI provider failures", () => {
  it("handles Claude failures for Summarization", async () => {
    generateClaudeResponse.mockRejectedValue(
      new Error("Claude unavailable")
    );

    const response = await request(app)
      .post("/api/ai/summarize")
      .send({ notes: "Study notes." });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected server error.",
    });
  });

  it("handles Claude failures for Flashcards", async () => {
    generateClaudeResponse.mockRejectedValue(
      new Error("Claude unavailable")
    );

    const response = await request(app)
      .post("/api/ai/flashcards")
      .send({ notes: "Study notes." });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected server error.",
    });
  });
});
