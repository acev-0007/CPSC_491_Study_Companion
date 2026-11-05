import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { setSession, getUser, updateUser } = vi.hoisted(() => ({
  setSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(),
}));
vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: () => ({ auth: { setSession, getUser, updateUser } }),
}));
import routes from "../src/routes/authRoutes.js";
const app = express();
app.use(express.json());
app.use("/api/auth", routes);
const base = "/api/auth/password-recovery";
const tokens = { accessToken: "valid-access", refreshToken: "valid-refresh" };

beforeEach(() => {
  setSession.mockReset().mockResolvedValue({ data: { session: { access_token: "verified-access" }, user: { id: "user-1" } }, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  updateUser.mockReset().mockResolvedValue({ error: null });
});

describe("SCRUM-292 password reset completion", () => {
  it("verifies Supabase session on validation and creates no cookies", async () => {
    const res = await request(app).post(base + "/validate").send(tokens);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
    expect(setSession).not.toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledWith(tokens.accessToken);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects missing or invalid tokens", async () => {
    expect((await request(app).post(base + "/validate").send({})).status).toBe(401);
    expect(setSession).not.toHaveBeenCalled();
    getUser.mockResolvedValueOnce({ error: { status: 401 }, data: null });
    expect((await request(app).post(base + "/validate").send(tokens)).status).toBe(401);
  });

  it("rejects a user identity mismatch", async () => {
    setSession.mockResolvedValueOnce({ data: { session: { access_token: "verified-access" }, user: { id: "user-1" } }, error: null });
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-2" } }, error: null });
    expect((await request(app).post(base + "/complete").send({ ...tokens, password: "newPassword123!" })).status).toBe(401);
  });

  it("updates password after revalidating the session", async () => {
    const res = await request(app).post(base + "/complete").send({ ...tokens, password: "newPassword123!" });
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "newPassword123!" });
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("never updates a password when validation fails", async () => {
    setSession.mockResolvedValueOnce({ data: null, error: { status: 401 } });
    const res = await request(app).post(base + "/complete").send({ ...tokens, password: "newPassword123!" });
    expect(res.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each(["short", "", 42, "x".repeat(129)])("rejects invalid passwords: %j", async (password) => {
    const res = await request(app).post(base + "/complete").send({ ...tokens, password });
    expect(res.status).toBe(400);
    expect(setSession).not.toHaveBeenCalled();
  });

  it("rejects reuse of the current password and never reports success", async () => {
    updateUser.mockResolvedValueOnce({
      error: { status: 422, code: "same_password", message: "Supabase internal details" },
    });
    const res = await request(app).post(base + "/complete").send({
      ...tokens,
      password: "currentPassword123!",
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      code: "same_password",
      error: "Choose a password different from your current password.",
    });
    expect(updateUser).toHaveBeenCalledOnce();
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("Supabase internal details");
  });

  it("does not reveal provider error messages", async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 500, message: "private Supabase detail" } });
    const res = await request(app).post(base + "/complete").send({ ...tokens, password: "newPassword123!" });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("private Supabase detail");
  });

  it("handles throttling and temporary validation service failures", async () => {
    getUser.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    expect((await request(app).post(base + "/validate").send(tokens)).status).toBe(429);
    getUser.mockResolvedValueOnce({ data: null, error: { status: 503 } });
    expect((await request(app).post(base + "/validate").send(tokens)).status).toBe(503);
  });
});
