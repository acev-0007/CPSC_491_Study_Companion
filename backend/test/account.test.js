import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const user = { id: "user-a", email: "student@example.com", created_at: "2026-11-01T00:00:00Z", user_metadata: { display_name: "Study User" } };
const mock = vi.hoisted(() => ({
  createSignedUrl: vi.fn(), upload: vi.fn(), remove: vi.fn(),
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
