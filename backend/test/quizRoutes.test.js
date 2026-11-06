import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// SCRUM-125: tests POST /api/ai/quiz through the real Express app
// (createApp): real auth middleware, routing, validation and error handling.
// Only Supabase auth and the Claude provider are mocked, so CI never makes a
// billable AI request. The live provider check is quizRoutes.live.test.js.

const { getUserMock, generateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: () => ({
    auth: { getUser: getUserMock, refreshSession: vi.fn() },
  }),
  createUserSupabaseClient: vi.fn(),
}));

vi.mock("../src/providers/claudeProvider.js", () => ({
  generateClaudeResponse: generateMock,
}));

import { createApp } from "../src/app.js";

const app = createApp();

const question = (n, overrides = {}) => ({
  question: `Question ${n}?`,
  options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`],
  correctOptionId: "B",
  ...overrides,
});

const validQuiz = (overrides = {}) => ({
  questions: [1, 2, 3, 4, 5].map((n) => question(n, overrides)),
});

function postQuiz(body) {
  return request(app)
    .post("/api/ai/quiz")
    .set("Cookie", "asc_access_token=valid")
    .send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({
    data: { user: { id: "student-1" } },
    error: null,
  });
});

describe("POST /api/ai/quiz", () => {
  it("AIQ-01/02/03: returns 5 questions with 4 options and a valid answer key", async () => {
    generateMock.mockResolvedValue(JSON.stringify(validQuiz()));

    const response = await postQuiz({ notes: "Operating systems notes." });

    expect(response.status).toBe(200);
    expect(response.body.questions).toHaveLength(5);

    for (const q of response.body.questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.id)).toEqual(["A", "B", "C", "D"]);
      expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
    }

    expect(response.body.questions.map((q) => q.id)).toEqual([
      "q1", "q2", "q3", "q4", "q5",
    ]);
    expect(generateMock).toHaveBeenCalledOnce();
  });

  it("sends the study material to the provider", async () => {
    generateMock.mockResolvedValue(JSON.stringify(validQuiz()));

    await postQuiz({ notes: "Deadlock needs circular wait." });

    expect(generateMock.mock.calls[0][0]).toContain(
      "Deadlock needs circular wait."
    );
  });

  it("accepts JSON wrapped in a Markdown code fence", async () => {
    generateMock.mockResolvedValue(
      "```json\n" + JSON.stringify(validQuiz()) + "\n```"
    );

    const response = await postQuiz({ notes: "Notes." });

    expect(response.status).toBe(200);
    expect(response.body.questions).toHaveLength(5);
  });

  it("AIQ-04: rejects empty, missing and non-string notes", async () => {
    for (const body of [{}, { notes: "   " }, { notes: 42 }]) {
      const response = await postQuiz(body);
      expect(response.status).toBe(400);
    }
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("AIQ-05: rejects notes over 20,000 characters", async () => {
    const response = await postQuiz({ notes: "a".repeat(20001) });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Study material cannot exceed 20,000 characters."
    );
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("AIQ-06: rejects anonymous requests before calling the provider", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });

    const response = await request(app)
      .post("/api/ai/quiz")
      .send({ notes: "Notes." });

    expect(response.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("AIQ-07: returns a controlled 500 when the provider fails", async () => {
    generateMock.mockRejectedValue(new Error("ANTHROPIC_API_KEY is wrong"));

    const response = await postQuiz({ notes: "Notes." });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unexpected server error." });
    expect(JSON.stringify(response.body)).not.toContain("ANTHROPIC");
  });
});

describe("POST /api/ai/quiz: invalid AI output returns 502", () => {
  const cases = {
    "not JSON": "Here are your questions!",
    "no questions array": JSON.stringify({ quiz: [] }),
    "too few questions": JSON.stringify({
      questions: validQuiz().questions.slice(0, 4),
    }),
    "too many questions": JSON.stringify({
      questions: [...validQuiz().questions, question(6)],
    }),
    "three options": JSON.stringify(
      validQuiz({ options: ["a", "b", "c"] })
    ),
    "duplicate options": JSON.stringify(
      validQuiz({ options: ["same", "same", "c", "d"] })
    ),
    "empty option text": JSON.stringify(
      validQuiz({ options: ["a", "  ", "c", "d"] })
    ),
    "correct answer outside A-D": JSON.stringify(
      validQuiz({ correctOptionId: "E" })
    ),
    "missing correct answer": JSON.stringify(
      validQuiz({ correctOptionId: undefined })
    ),
    "empty question text": JSON.stringify(validQuiz({ question: "" })),
    "truncated JSON": JSON.stringify(validQuiz()).slice(0, 120),
  };

  it.each(Object.entries(cases))("%s", async (_name, aiOutput) => {
    generateMock.mockResolvedValue(aiOutput);

    const response = await postQuiz({ notes: "Notes." });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: "Quiz generation failed." });
  });
});