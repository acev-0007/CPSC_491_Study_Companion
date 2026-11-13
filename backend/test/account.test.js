import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const user = { id: "user-a", email: "student@example.com", created_at: "2026-11-01T00:00:00Z", user_metadata: { display_name: "Study User" } };
const mock = vi.hoisted(() => ({
  createSignedUrl: vi.fn(), upload: vi.fn(), remove: vi.fn(), signInWithPassword: vi.fn(),
}));
vi.mock("../src/middleware/requireAuth.js", () => ({
  requireAuth: (req, res, next) => {
    if (req.headers["x-test-anonymous"]) return res.status(401).json({ error: "Authentication required." });
    req.user = structuredClone(user);
    req.accessToken = "test-access-token";
    next();
  },
}));
vi.mock("../src/config/supabase.js", () => ({
  createUserSupabaseClient: () => ({ storage: { from: () => mock } }),
  createSupabaseClient: () => ({ auth: { signInWithPassword: mock.signInWithPassword } }),
}));
import express from "express";
import accountRoutes from "../src/routes/accountRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/account", accountRoutes);

beforeEach(() => {
  vi.restoreAllMocks();
  mock.createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null });
  mock.upload.mockReset().mockResolvedValue({ error: null });
  mock.remove.mockReset().mockResolvedValue({ error: null });
  mock.signInWithPassword.mockReset().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key");
});

describe("SCRUM-280 account routes", () => {
  it("returns only the signed-in user's public profile", async () => {
    const res = await request(app).get("/api/account");
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: "user-a", email: "student@example.com", displayName: "Study User", createdAt: "2026-11-01T00:00:00Z", avatarUrl: null });
  });
  it("rejects anonymous access", async () => {
    expect((await request(app).get("/api/account").set("x-test-anonymous", "1")).status).toBe(401);
  });
  it("rejects invalid names", async () => {
    expect((await request(app).patch("/api/account").send({ displayName: "  " })).status).toBe(400);
    expect((await request(app).patch("/api/account").send({ displayName: "x".repeat(81) })).status).toBe(400);
  });
  it("updates only the intended display name", async () => {
    const changed = { ...user, user_metadata: { display_name: "New Name" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => changed }));
    const res = await request(app).patch("/api/account").send({ displayName: " New Name ", admin: true });
    expect(res.status).toBe(200);
    const requestBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(requestBody.data.display_name).toBe("New Name");
    expect(requestBody.data.admin).toBeUndefined();
  });
  it("rejects unsupported and spoofed avatar files", async () => {
    expect((await request(app).post("/api/account/avatar").attach("avatar", Buffer.from("not an image"), { filename: "fake.png", contentType: "image/png" })).status).toBe(400);
    expect((await request(app).post("/api/account/avatar").attach("avatar", Buffer.from("hello"), { filename: "bad.txt", contentType: "text/plain" })).status).toBe(400);
  });
  it("uploads an avatar under the authenticated user's folder", async () => {
    const changed = { ...user, user_metadata: { display_name: "Study User", avatar_path: "user-a/photo.png" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => changed }));
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const res = await request(app).post("/api/account/avatar").attach("avatar", png, { filename: "photo.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(mock.upload.mock.calls[0][0]).toMatch(/^user-a\/[a-f0-9-]+\.png$/);
  });
  it("removes avatar metadata on request", async () => {
    const changed = { ...user, user_metadata: { display_name: "Study User", avatar_path: null } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => changed }));
    const res = await request(app).delete("/api/account/avatar");
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe(null);
  });
});

describe("SCRUM-282 authenticated password change", () => {
  const valid = { currentPassword: "oldPassword!123", newPassword: "newPassword!456", confirmPassword: "newPassword!456" };
  it("rejects anonymous attempts before touching Supabase", async () => {
    expect((await request(app).patch("/api/account/password").set("x-test-anonymous", "1").send(valid)).status).toBe(401);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it("validates missing, short, mismatched, and reused passwords", async () => {
    for (const body of [
      { ...valid, currentPassword: "" },
      { ...valid, newPassword: "short", confirmPassword: "short" },
      { ...valid, confirmPassword: "not matching" },
      { ...valid, newPassword: valid.currentPassword, confirmPassword: valid.currentPassword },
    ]) expect((await request(app).patch("/api/account/password").send(body)).status).toBe(400);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it("does not update when current password is incorrect or identity mismatches", async () => {
    mock.signInWithPassword.mockResolvedValueOnce({ data: null, error: { message: "Invalid login credentials" } });
    expect((await request(app).patch("/api/account/password").send(valid)).status).toBe(400);
    mock.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "other-user" } }, error: null });
    expect((await request(app).patch("/api/account/password").send(valid)).status).toBe(400);
  });
  it("verifies current password then updates only the authenticated Supabase user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const res = await request(app).patch("/api/account/password").send(valid);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Password updated successfully." });
    expect(mock.signInWithPassword).toHaveBeenCalledWith({ email: "student@example.com", password: valid.currentPassword });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-access-token");
    expect(JSON.parse(options.body)).toEqual({ password: valid.newPassword, current_password: valid.currentPassword });
    expect(JSON.stringify(res.body)).not.toContain(valid.newPassword);
    expect(JSON.stringify(res.body)).not.toContain("test-access-token");
  });
  it("sanitizes upstream failures and does not return credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: valid.newPassword, access_token: "secret" }) }));
    const res = await request(app).patch("/api/account/password").send(valid);
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain(valid.newPassword);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
  it("reports upstream current-password, policy and throttling failures safely", async () => {
    for (const [code, expected] of [["current_password_mismatch",400],["weak_password",400],["same_password",400]]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok:false, status:422, json:async()=>({code}) }));
      expect((await request(app).patch("/api/account/password").send(valid)).status).toBe(expected);
    }
    mock.signInWithPassword.mockResolvedValueOnce({ data:null, error:{status:429} });
    expect((await request(app).patch("/api/account/password").send(valid)).status).toBe(429);
  });
});
