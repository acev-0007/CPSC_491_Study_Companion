import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { getUserMock, refreshSessionMock, generateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: () => ({
    auth: { getUser: getUserMock, refreshSession: refreshSessionMock },
  }),
  createUserSupabaseClient: vi.fn(),
}));

vi.mock("../src/providers/claudeProvider.js", () => ({
  generateClaudeResponse: generateMock,
}));

import { createApp } from "../src/app.js";

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
  refreshSessionMock.mockResolvedValue({ data: { session: null, user: null }, error: new Error("invalid") });
  generateMock.mockResolvedValue("Generated response");
});

describe("AI API authentication boundary", () => {
  it.each([
    ["/api/ai/generate", { prompt: "Explain arrays" }],
    ["/api/ai/summarize", { notes: "Some notes" }],
  ])("rejects anonymous POST %s before calling the provider", async (url, body) => {
    const result = await request(app).post(url).send(body);
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("Authentication required.");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid session cookie", async () => {
    const result = await request(app)
      .post("/api/ai/generate")
      .set("Cookie", "asc_access_token=invalid")
      .send({ prompt: "Hello" });
    expect(result.status).toBe(401);
    expect(getUserMock).toHaveBeenCalledWith("invalid");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/ai/generate", { prompt: "Explain arrays" }, "response"],
    ["/api/ai/summarize", { notes: "Some notes" }, "summary"],
  ])("allows authenticated POST %s", async (url, body, resultKey) => {
    getUserMock.mockResolvedValue({ data: { user: { id: "student-1" } }, error: null });
    const result = await request(app)
      .post(url)
      .set("Cookie", "asc_access_token=valid")
      .send(body);
    expect(result.status).toBe(200);
    expect(result.body[resultKey]).toBe("Generated response");
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the public health endpoint available", async () => {
    const result = await request(app).get("/api/health");
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
  });
});
