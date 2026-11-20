import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// SCRUM-128: POST /api/ai/quiz also stores a trusted snapshot of the quiz
// (answer key, topic, categories) and returns its id. Real Express app; only
// Supabase and the Claude provider are mocked.

const { getUserMock, generateMock, userClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  generateMock: vi.fn(),
  userClientMock: vi.fn(),
}));

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: () => ({
    auth: { getUser: getUserMock, refreshSession: vi.fn() },
  }),
  createServiceRoleSupabaseClient: userClientMock,
  createUserSupabaseClient: vi.fn(),
}));

vi.mock("../src/providers/claudeProvider.js", () => ({
  generateClaudeResponse: generateMock,
}));

import { createApp } from "../src/app.js";
import { parseQuiz, parseQuizTopic } from "../src/quizValidator.js";

const app = createApp();
const QUIZ_ID = "550e8400-e29b-41d4-a716-446655440000";

const question = (n, overrides = {}) => ({
  question: `Question ${n}?`,
  options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`],
  correctOptionId: "B",
  ...overrides,
});

const aiQuiz = ({ topic, categoryFor } = {}) =>
  JSON.stringify({
    ...(topic !== undefined && { topic }),
    questions: [1, 2, 3, 4, 5].map((n) =>
      question(n, categoryFor ? { category: categoryFor(n) } : {})
    ),
  });

function mockInsert(result) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  userClientMock.mockReturnValue({ from });
  return { from, insert };
}

const postQuiz = () =>
  request(app)
    .post("/api/ai/quiz")
    .set("Cookie", "asc_access_token=valid")
    .send({ notes: "Operating systems notes." });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  getUserMock.mockResolvedValue({
    data: { user: { id: "student-1" } },
    error: null,
  });
});

describe("quiz snapshot persistence", () => {
  it("stores the quiz with the session user and returns its id and topic", async () => {
    generateMock.mockResolvedValue(
      aiQuiz({ topic: "Operating Systems", categoryFor: () => "Deadlocks" })
    );
    const { from, insert } = mockInsert({ data: { id: QUIZ_ID }, error: null });

    const response = await postQuiz();

    expect(response.status).toBe(200);
    expect(response.body.quizId).toBe(QUIZ_ID);
    expect(response.body.topic).toBe("Operating Systems");
    expect(response.body.questions).toHaveLength(5);
    expect(response.body.questions[0].category).toBe("Deadlocks");

    expect(from).toHaveBeenCalledWith("generated_quizzes");
    const saved = insert.mock.calls[0][0];
    expect(saved.user_id).toBe("student-1");
    expect(saved.topic).toBe("Operating Systems");
    // The stored snapshot is the validated quiz, including the answer key.
    expect(saved.questions).toEqual(response.body.questions);
    expect(saved.questions[0].correctOptionId).toBe("B");
  });

  it("still returns the quiz, with quizId null, when the snapshot cannot be saved", async () => {
    generateMock.mockResolvedValue(aiQuiz({ topic: "Networks" }));
    mockInsert({ data: null, error: { message: "db down" } });

    const response = await postQuiz();

    expect(response.status).toBe(200);
    expect(response.body.quizId).toBeNull();
    expect(response.body.questions).toHaveLength(5);
    expect(console.error).toHaveBeenCalled();
  });

  it("does not store anything when the AI output is invalid", async () => {
    generateMock.mockResolvedValue("not json");
    const { insert } = mockInsert({ data: { id: QUIZ_ID }, error: null });

    const response = await postQuiz();

    expect(response.status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("parseQuiz categories and topic", () => {
  it("keeps clean category labels", () => {
    const questions = parseQuiz(aiQuiz({ categoryFor: (n) => `  Topic   ${n} ` }));
    expect(questions[0].category).toBe("Topic 1");
  });

  it("falls back to General when a category is missing or unusable", () => {
    const missing = parseQuiz(aiQuiz());
    expect(missing.every((q) => q.category === "General")).toBe(true);

    const tooLong = parseQuiz(aiQuiz({ categoryFor: () => "x".repeat(61) }));
    expect(tooLong[0].category).toBe("General");
  });

  it("does not let a bad label invalidate the quiz or change the answer key", () => {
    const questions = parseQuiz(aiQuiz({ categoryFor: () => 42 }));
    expect(questions).toHaveLength(5);
    expect(questions[0].correctOptionId).toBe("B");
  });

  it("parses the topic, tolerating code fences, and defaults to General", () => {
    expect(parseQuizTopic(aiQuiz({ topic: " Operating  Systems " }))).toBe(
      "Operating Systems"
    );
    expect(parseQuizTopic("```json\n" + aiQuiz({ topic: "Networks" }) + "\n```")).toBe(
      "Networks"
    );
    expect(parseQuizTopic(aiQuiz())).toBe("General");
    expect(parseQuizTopic(aiQuiz({ topic: "y".repeat(81) }))).toBe("General");
    expect(parseQuizTopic("garbage")).toBe("General");
    expect(parseQuizTopic(undefined)).toBe("General");
  });
});
