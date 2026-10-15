import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// Scope: POST /api/topics (FLASH-TEST-1) plus the topic -> flashcard
// ownership handoff. Mirrors the mock approach in flashcards.test.js.

let store;

function resetStore() {
  store = { topics: [], flashcards: [] };
}

function makeFakeSupabase() {
  return {
    from(table) {
      const filters = [];
      const rows = () => store[table] ?? [];

      const builder = {
        select() {
          return builder;
        },
        eq(col, val) {
          filters.push([col, val]);
          return builder;
        },
        maybeSingle: async () => {
          const match = rows().find((r) =>
            filters.every(([c, v]) => r[c] === v)
          );
          return { data: match ?? null, error: null };
        },
        insert(obj) {
          // Lets one test force the catch-all 500 path.
          if (obj.title === "TRIGGER_INSERT_ERROR") {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: new Error("db down"),
                }),
              }),
            };
          }

          const row = {
            id: randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...obj,
          };

          return {
            select() {
              return {
                // topics: .insert().select().single()
                single: async () => {
                  store[table].push(row);
                  return { data: row, error: null };
                },
                // flashcards: await .insert().select()
                then(resolve) {
                  store[table].push(row);
                  resolve({ data: [row], error: null });
                },
              };
            },
          };
        },
      };

      return builder;
    },
  };
}

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (accessToken) => {
        const users = {
          "student-1-token": { id: "student-1" },
          "student-2-token": { id: "student-2" },
        };
        const user = users[accessToken];
        if (user) return { data: { user }, error: null };
        return { data: { user: null }, error: new Error("Invalid test token") };
      }),
      refreshSession: vi.fn(),
    },
  })),
  createUserSupabaseClient: vi.fn(() => makeFakeSupabase()),
}));

const { ACCESS_COOKIE } = await import("../src/auth/sessionCookies.js");
const { createApp } = await import("../src/app.js");

const app = createApp();

const asStudent1 = (req) => req.set("Cookie", `${ACCESS_COOKIE}=student-1-token`);
const asStudent2 = (req) => req.set("Cookie", `${ACCESS_COOKIE}=student-2-token`);

describe("POST /api/topics (FLASH-TEST-1)", () => {
  beforeEach(() => {
    resetStore();
  });

  // ---- auth ----

  it("rejects requests without authentication", async () => {
    const response = await request(app)
      .post("/api/topics")
      .send({ title: "OS Concepts" });

    expect(response.status).toBe(401);
    expect(store.topics).toHaveLength(0);
  });

  // ---- success ----

  it("creates a topic and returns it with a generated id", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.title).toBe("OS Concepts");
    expect(response.body.user_id).toBe("student-1");
    expect(store.topics).toHaveLength(1);
  });

  it("trims the title before saving", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "   OS Concepts   ",
    });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("OS Concepts");
  });

  it("stores source_text when provided", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
      source_text: "Processes and threads...",
    });

    expect(response.status).toBe(201);
    expect(response.body.source_text).toBe("Processes and threads...");
  });

  it("stores null source_text when omitted", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
    });

    expect(response.status).toBe(201);
    expect(response.body.source_text).toBeNull();
  });

  it("derives user_id from the session, ignoring one in the body", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
      user_id: "student-2",
    });

    expect(response.status).toBe(201);
    expect(response.body.user_id).toBe("student-1");
    expect(store.topics[0].user_id).toBe("student-1");
  });

  // ---- validation ----

  it("rejects a missing title", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/title/i);
    expect(store.topics).toHaveLength(0);
  });

  it("rejects a blank title", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "    ",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/title/i);
  });

  it("rejects a non-string title", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: 12345,
    });

    expect(response.status).toBe(400);
  });

  it("rejects a title longer than 255 characters", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "a".repeat(256),
    });

    expect(response.status).toBe(400);
    expect(store.topics).toHaveLength(0);
  });

  it("accepts a title of exactly 255 characters", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "a".repeat(255),
    });

    expect(response.status).toBe(201);
  });

  it("rejects a non-string source_text", async () => {
    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
      source_text: { not: "a string" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/source_text/i);
  });

  // ---- database failure ----

  it("returns 500 when the insert fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await asStudent1(request(app).post("/api/topics")).send({
      title: "TRIGGER_INSERT_ERROR",
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to create topic.");

    errorSpy.mockRestore();
  });

  // ---- topic -> flashcard handoff ----

  it("lets the owner save a card under the new topic", async () => {
    const topic = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
    });

    const card = await asStudent1(request(app).post("/api/flashcards")).send({
      topic_id: topic.body.id,
      front: "What is a mutex?",
      back: "A locking primitive.",
    });

    expect(card.status).toBe(201);
    expect(card.body.topic_id).toBe(topic.body.id);
    expect(card.body.user_id).toBe("student-1");
  });

  it("does not let another user save a card under that topic", async () => {
    const topic = await asStudent1(request(app).post("/api/topics")).send({
      title: "OS Concepts",
    });

    const card = await asStudent2(request(app).post("/api/flashcards")).send({
      topic_id: topic.body.id,
      front: "Sneaky",
      back: "Card",
    });

    expect(card.status).toBe(400);
    expect(store.flashcards).toHaveLength(0);
  });
});