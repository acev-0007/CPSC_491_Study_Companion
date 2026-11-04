import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }));
vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: () => ({ auth: { resetPasswordForEmail: resetMock } }),
}));
import authRoutes from "../src/routes/authRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use((_error, _req, res, _next) => res.status(500).json({ error: "Unexpected server error." }));

const path = "/api/auth/password-recovery";
const confirmation = "If an account exists for that email address, we've sent password reset instructions.";

beforeEach(() => {
  resetMock.mockReset().mockResolvedValue({ error: null });
  process.env.FRONTEND_ORIGIN = "http://localhost:5173";
});
afterEach(() => { delete process.env.FRONTEND_ORIGIN; });

describe("POST password-recovery", () => {
  it("sends a normalized email with the fixed reset destination", async () => {
    const response = await request(app).post(path).send({ email: " Student@Example.com " });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: confirmation });
    expect(resetMock).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "http://localhost:5173/reset-password",
    });
  });

  it.each([{}, { email: "" }, { email: "not-an-email" }, { email: 15 }, { email: "a".repeat(255) + "@example.com" }])(
    "rejects malformed requests without calling Supabase: %j", async (body) => {
      const response = await request(app).post(path).send(body);
      expect(response.status).toBe(400);
      expect(resetMock).not.toHaveBeenCalled();
    }
  );

  it("returns identical confirmations for unknown and known email accounts", async () => {
    const known = await request(app).post(path).send({ email: "known@example.com" });
    resetMock.mockResolvedValueOnce({ error: { status: 404, code: "user_not_found" } });
    const unknown = await request(app).post(path).send({ email: "unknown@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("reports throttling without leaking Supabase messages", async () => {
    resetMock.mockResolvedValueOnce({ error: { status: 429, message: "internal limit details" } });
    const response = await request(app).post(path).send({ email: "student@example.com" });
    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/too many recovery requests/i);
    expect(JSON.stringify(response.body)).not.toContain("internal limit details");
  });

  it("handles provider errors without leaking internal details", async () => {
    resetMock.mockResolvedValueOnce({ error: { status: 500, message: "SMTP credentials" } });
    const response = await request(app).post(path).send({ email: "student@example.com" });
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("SMTP credentials");
  });

  it("does not allow request parameters to override the redirect URL", async () => {
    await request(app).post(path).send({ email: "student@example.com", redirectTo: "https://evil.example/" });
    expect(resetMock.mock.calls[0][1].redirectTo).toBe("http://localhost:5173/reset-password");
  });

  it("fails closed for an invalid public origin", async () => {
    process.env.FRONTEND_ORIGIN = "https://example.com/path";
    const response = await request(app).post(path).send({ email: "student@example.com" });
    expect(response.status).toBe(503);
    expect(resetMock).not.toHaveBeenCalled();
  });
});
