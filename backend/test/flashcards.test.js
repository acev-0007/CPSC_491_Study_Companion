import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
// =========================================================
// SCOPE
// =========================================================
// This file tests only the three flashcard endpoints added for FLASH-5:
//   GET  /api/flashcards
//   GET  /api/flashcards/:id
//   POST /api/flashcards
// It does not test /api/assignments, /api/documents, or /api/auth --
// those already have their own dedicated test files.
//
// =========================================================
// SUPABASE MOCK
// =========================================================
// requireAuth (backend/src/middleware/requireAuth.js) and the flashcard
// routes (backend/src/app.js) both import backend/src/config/supabase.js,
// so mocking it once here covers both call sites.
//
// createUserSupabaseClient() returns a minimal in-memory fake query
// builder -- just enough to support the exact chains these routes call
// (.select/.eq/.order/.maybeSingle/.insert). No real Supabase project or
// network request is involved.
// =========================================================

let store;

const TOPIC_1_ID =
  "11111111-1111-4111-8111-111111111111";

const MISSING_TOPIC_ID =
  "22222222-2222-4222-8222-222222222222";

const MISSING_CARD_ID =
  "33333333-3333-4333-8333-333333333333";

function resetStore() {
  store = {
    topics: [
  {
    id: TOPIC_1_ID,
    user_id: "student-1",
    title: "OS Concepts"
  }
],
    flashcards: [],
  };
}

function makeFakeSupabase() {
  return {
    from(table) {
      const filters = [];
      const rows = () => store[table] || [];

      const builder = {
        select() {
          return builder;
        },
        eq(col, val) {
          filters.push([col, val]);
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle: async () => {
          const match = rows().find((r) =>
            filters.every(([c, v]) => r[c] === v)
          );
          return { data: match || null, error: null };
        },
        insert(obj) {
          // Lets one test force the catch-all 500 path, which is only
          // reachable now that topic ownership is checked *before* this
          // insert runs (see app.js) -- a bad topic_id never reaches
          // insert() anymore, so the old "simulate an FK failure here"
          // approach can't exercise that branch on its own.
          if (obj.front === "TRIGGER_INSERT_ERROR") {
            return {
              select: async () => ({ data: null, error: new Error("db down") }),
            };
          }

          const row = {
            id: randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...obj,
          };

          return {
            select: async () => {
              store.flashcards.push(row);
              return { data: [row], error: null };
            },
          };
        },
        then(resolve) {
          const matches = rows().filter((r) =>
            filters.every(([c, v]) => r[c] === v)
          );
          resolve({ data: matches, error: null });
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
const { createApp } =
  await import("../src/app.js");

const app = createApp();

describe("flashcards API (FLASH-5)", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---- auth ----

  it("rejects requests without authentication", async () => {
    const response = await request(app).get("/api/flashcards");
    expect(response.status).toBe(401);
  });

  // ---- POST /api/flashcards ----

  it("creates a flashcard under an existing, owned topic", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "What is a mutex?", back: "A locking primitive." });

    expect(response.status).toBe(201);
    expect(response.body.front).toBe("What is a mutex?");
    expect(response.body.back).toBe("A locking primitive.");
    expect(response.body.user_id).toBe("student-1");
  });

  it("rejects creation with a missing topic_id", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ front: "Q", back: "A" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/topic_id/i);
  });

  it("rejects creation with a missing front field", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, back: "Missing the front." });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/front/i);
  });

  it("rejects creation with a missing back field", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Missing the back." });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/back/i);
  });

  it("rejects creation against a topic_id that does not exist", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({
  topic_id: MISSING_TOPIC_ID,
  front: "Q",
  back: "A"
});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid topic_id/i);
  });

  it("rejects creation against a topic owned by another user", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Q", back: "A" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid topic_id/i);
  });

  it("returns 500 when the insert itself fails after a valid topic check", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "TRIGGER_INSERT_ERROR", back: "A" });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/failed to create flashcard/i);
  });

  it("ignores a user-supplied user_id and uses the session's instead", async () => {
    const response = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Q", back: "A", user_id: "someone-else" });

    expect(response.status).toBe(201);
    expect(response.body.user_id).toBe("student-1");
  });

  // ---- GET /api/flashcards ----

  it("retrieves flashcards created for the current user", async () => {
    await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Q1", back: "A1" });

    const response = await request(app)
      .get("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(200);
    expect(response.body.flashcards).toHaveLength(1);
    expect(response.body.flashcards[0].front).toBe("Q1");
  });

  it("returns an empty list when the user has no flashcards", async () => {
    const response = await request(app)
      .get("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(200);
    expect(response.body.flashcards).toEqual([]);
  });

  it("does not return another user's flashcards", async () => {
    await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Private card", back: "A" });

    const response = await request(app)
      .get("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`);

    expect(response.status).toBe(200);
    expect(response.body.flashcards).toEqual([]);
  });

  it("filters by topic_id when provided as a query param", async () => {
  await request(app)
    .post("/api/flashcards")
    .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
    .send({
      topic_id: TOPIC_1_ID,
      front: "Q1",
      back: "A1",
    });

  const response = await request(app)
    .get(`/api/flashcards?topic_id=${TOPIC_1_ID}`)
    .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

  expect(response.status).toBe(200);
  expect(response.body.flashcards).toHaveLength(1);
});

  // ---- GET /api/flashcards/:id ----

  it("retrieves a single flashcard by id", async () => {
    const created = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Q1", back: "A1" });

    const response = await request(app)
      .get(`/api/flashcards/${created.body.id}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(200);
    expect(response.body.front).toBe("Q1");
  });

  it("returns 404 for a flashcard id that does not exist", async () => {
    const response = await request(app)
      .get(
  `/api/flashcards/${MISSING_CARD_ID}`
)
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(404);
  });

  it("returns 404 when requesting another user's flashcard by id", async () => {
    const created = await request(app)
      .post("/api/flashcards")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({ topic_id: TOPIC_1_ID, front: "Q1", back: "A1" });

    const response = await request(app)
      .get(`/api/flashcards/${created.body.id}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`);

    expect(response.status).toBe(404);
  });

  it("rejects a malformed topic_id", async () => {
  const response = await request(app)
    .post("/api/flashcards")
    .set(
      "Cookie",
      `${ACCESS_COOKIE}=student-1-token`
    )
    .send({
      topic_id: "not-a-valid-uuid",
      front: "Q",
      back: "A",
    });

  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(
    /valid uuid/i
  );
});

  it("rejects a malformed topic_id query parameter", async () => {
  const response = await request(app)
    .get(
      "/api/flashcards?topic_id=not-a-valid-uuid"
    )
    .set(
      "Cookie",
      `${ACCESS_COOKIE}=student-1-token`
    );

  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(
    /valid uuid/i
  );
});

it("rejects a malformed flashcard id", async () => {
  const response = await request(app)
    .get(
      "/api/flashcards/not-a-valid-uuid"
    )
    .set(
      "Cookie",
      `${ACCESS_COOKIE}=student-1-token`
    );

  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(
    /valid uuid/i
  );
});
});