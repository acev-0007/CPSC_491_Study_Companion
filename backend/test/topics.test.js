import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// Scope: POST /api/topics (FLASH-TEST-1), the topic -> flashcard ownership
// handoff, and FLASH-DECK-1 (GET /api/topics, DELETE /api/topics/:id).
// Mirrors the mock approach in flashcards.test.js.
//
// The fake database simulates ON DELETE CASCADE so the delete tests can
// assert on its effect. The real constraint lives in database/schema.sql
// and is not exercised here.

let store;

// Set to true to make the next delete() fail like a database error.
let failDelete;

function resetStore() {
  store = { topics: [], flashcards: [] };
  failDelete = false;
}

function makeFakeSupabase() {
  return {
    from(table) {
      const filters = [];
      const rows = () => store[table] ?? [];

      let selectColumns = "";
      let order = null;
      let deleting = false;

      const matching = () =>
        rows().filter((r) => filters.every(([c, v]) => r[c] === v));

      const builder = {
        select(columns = "") {
          selectColumns = columns;
          return builder;
        },
        eq(col, val) {
          filters.push([col, val]);
          return builder;
        },
        order(col, { ascending = true } = {}) {
          order = { col, ascending };
          return builder;
        },
        delete() {
          deleting = true;
          return builder;
        },
        // Lets a query chain be awaited, like supabase-js does.
        then(resolve) {
          if (deleting) {
            if (failDelete) {
              return resolve({ data: null, error: new Error("db down") });
            }

            const removed = matching();
            store[table] = rows().filter((r) => !removed.includes(r));

            // Simulates flashcards.topic_id ... ON DELETE CASCADE.
            if (table === "topics") {
              const ids = removed.map((r) => r.id);
              store.flashcards = store.flashcards.filter(
                (card) => !ids.includes(card.topic_id)
              );
            }

            return resolve({
              data: removed.map((r) => ({ id: r.id })),
              error: null,
            });
          }

          let result = matching();

          if (order) {
            const dir = order.ascending ? 1 : -1;
            result = [...result].sort((a, b) =>
              a[order.col] < b[order.col] ? -dir : a[order.col] > b[order.col] ? dir : 0
            );
          }

          // Embedded count: select("..., flashcards(count)")
          if (selectColumns.includes("flashcards(count)")) {
            result = result.map((topic) => ({
              id: topic.id,
              title: topic.title,
              created_at: topic.created_at,
              flashcards: [
                {
                  count: store.flashcards.filter(
                    (card) => card.topic_id === topic.id
                  ).length,
                },
              ],
            }));
          }

          return resolve({ data: result, error: null });
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


// =========================================================
// FLASH-DECK-1: Saved Flashcard Deck Management
// =========================================================

const TOPIC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOPIC_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOPIC_OTHER_USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MISSING_TOPIC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function seedDecks() {
  store.topics = [
    {
      id: TOPIC_A,
      user_id: "student-1",
      title: "Operating Systems",
      created_at: "2026-10-01T10:00:00.000Z",
    },
    {
      id: TOPIC_B,
      user_id: "student-1",
      title: "Databases",
      created_at: "2026-10-10T10:00:00.000Z",
    },
    {
      id: TOPIC_OTHER_USER,
      user_id: "student-2",
      title: "Private deck",
      created_at: "2026-10-05T10:00:00.000Z",
    },
  ];

  store.flashcards = [
    { id: "f1", topic_id: TOPIC_A, user_id: "student-1", front: "Q1", back: "A1" },
    { id: "f2", topic_id: TOPIC_A, user_id: "student-1", front: "Q2", back: "A2" },
    { id: "f3", topic_id: TOPIC_B, user_id: "student-1", front: "Q3", back: "A3" },
    { id: "f4", topic_id: TOPIC_OTHER_USER, user_id: "student-2", front: "Q4", back: "A4" },
  ];
}

describe("GET /api/topics (FLASH-DECK-1)", () => {
  beforeEach(() => {
    resetStore();
    seedDecks();
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get("/api/topics");

    expect(response.status).toBe(401);
  });

  it("returns only the authenticated user's topics", async () => {
    const response = await asStudent1(request(app).get("/api/topics"));

    expect(response.status).toBe(200);
    expect(response.body.topics.map((t) => t.id)).not.toContain(TOPIC_OTHER_USER);
    expect(response.body.topics).toHaveLength(2);
  });

  it("returns newest decks first", async () => {
    const response = await asStudent1(request(app).get("/api/topics"));

    expect(response.body.topics.map((t) => t.id)).toEqual([TOPIC_B, TOPIC_A]);
  });

  it("includes id, title, created_at and card_count for each deck", async () => {
    const response = await asStudent1(request(app).get("/api/topics"));

    expect(response.body.topics).toEqual([
      {
        id: TOPIC_B,
        title: "Databases",
        created_at: "2026-10-10T10:00:00.000Z",
        card_count: 1,
      },
      {
        id: TOPIC_A,
        title: "Operating Systems",
        created_at: "2026-10-01T10:00:00.000Z",
        card_count: 2,
      },
    ]);
  });

  it("does not expose source_text or user_id", async () => {
    const response = await asStudent1(request(app).get("/api/topics"));

    for (const topic of response.body.topics) {
      expect(topic).not.toHaveProperty("source_text");
      expect(topic).not.toHaveProperty("user_id");
    }
  });

  it("returns an empty list for a user with no decks", async () => {
    store.topics = [];

    const response = await asStudent1(request(app).get("/api/topics"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ topics: [] });
  });
});

describe("DELETE /api/topics/:id (FLASH-DECK-1)", () => {
  beforeEach(() => {
    resetStore();
    seedDecks();
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).delete(`/api/topics/${TOPIC_A}`);

    expect(response.status).toBe(401);
    expect(store.topics).toHaveLength(3);
  });

  it("returns 400 for a malformed UUID", async () => {
    const response = await asStudent1(
      request(app).delete("/api/topics/not-a-uuid")
    );

    expect(response.status).toBe(400);
    expect(store.topics).toHaveLength(3);
  });

  it("returns 404 for a topic that does not exist", async () => {
    const response = await asStudent1(
      request(app).delete(`/api/topics/${MISSING_TOPIC}`)
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 and deletes nothing for another user's topic", async () => {
    const response = await asStudent1(
      request(app).delete(`/api/topics/${TOPIC_OTHER_USER}`)
    );

    expect(response.status).toBe(404);
    expect(store.topics.map((t) => t.id)).toContain(TOPIC_OTHER_USER);
    expect(
      store.flashcards.filter((c) => c.topic_id === TOPIC_OTHER_USER)
    ).toHaveLength(1);
  });

  it("deletes an owned topic and returns 204 with no body", async () => {
    const response = await asStudent1(
      request(app).delete(`/api/topics/${TOPIC_A}`)
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(store.topics.map((t) => t.id)).toEqual([TOPIC_B, TOPIC_OTHER_USER]);
  });

  it("removes the deck's flashcards through the cascade", async () => {
    await asStudent1(request(app).delete(`/api/topics/${TOPIC_A}`));

    expect(store.flashcards.filter((c) => c.topic_id === TOPIC_A)).toHaveLength(0);
  });

  it("leaves other decks' flashcards untouched", async () => {
    await asStudent1(request(app).delete(`/api/topics/${TOPIC_A}`));

    expect(store.flashcards.map((c) => c.id).sort()).toEqual(["f3", "f4"]);
  });

  it("returns 404 when the same deck is deleted twice", async () => {
    const first = await asStudent1(request(app).delete(`/api/topics/${TOPIC_A}`));
    const second = await asStudent1(request(app).delete(`/api/topics/${TOPIC_A}`));

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });

  it("returns 500 when the database delete fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    failDelete = true;

    const response = await asStudent1(
      request(app).delete(`/api/topics/${TOPIC_A}`)
    );

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to delete topic.");
    expect(store.topics).toHaveLength(3);

    errorSpy.mockRestore();
  });
});