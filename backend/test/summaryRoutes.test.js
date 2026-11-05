
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";

import express from "express";
import request from "supertest";

import { requireAuth } from "../src/middleware/requireAuth.js";
import { createUserSupabaseClient } from "../src/config/supabase.js";
import summaryRoutes from "../src/routes/summaryRoutes.js";

// Mock authentication so no real Supabase login is needed.
vi.mock("../src/middleware/requireAuth.js", () => ({
  requireAuth: vi.fn((req, res, next) => {
    req.user = { id: "test-user-123" };
    req.accessToken = "mock-access-token";
    next();
  }),
}));

// Mock Supabase so no real database records are created.
vi.mock("../src/config/supabase.js", () => ({
  createUserSupabaseClient: vi.fn(),
}));

const app = express();

app.use(express.json());
app.use("/api/summaries", summaryRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: "Unexpected server error.",
  });
});

const savedRecord = {
  id: "summary-test-123",
  created_at: "2026-10-15T12:00:00Z",
};

let insertMock;
let fromMock;
let getSelectMock;
let eqMock;
let orderMock;


beforeEach(() => {
  vi.clearAllMocks();

  // SCRUM-231: Mock summary saving.
  insertMock = vi.fn();

  const singleMock = vi.fn().mockResolvedValue({
    data: savedRecord,
    error: null,
  });

  const insertSelectMock = vi.fn().mockReturnValue({
    single: singleMock,
  });

  insertMock.mockReturnValue({
    select: insertSelectMock,
  });

  // SCRUM-232: Mock summary retrieval.
  orderMock = vi.fn().mockResolvedValue({
    data: [
      {
        id: "summary-1",
        source_text: "Encapsulation hides data.",
        summary_text: "Encapsulation protects data.",
        created_at: "2026-10-15T12:00:00Z",
      },
      {
        id: "summary-2",
        source_text: "Inheritance supports code reuse.",
        summary_text: "Inheritance allows reuse.",
        created_at: "2026-10-14T12:00:00Z",
      },
    ],
    error: null,
  });

  eqMock = vi.fn().mockReturnValue({
    order: orderMock,
  });

  getSelectMock = vi.fn().mockReturnValue({
    eq: eqMock,
  });

  fromMock = vi.fn().mockReturnValue({
    insert: insertMock,
    select: getSelectMock,
  });

  createUserSupabaseClient.mockReturnValue({
    from: fromMock,
  });

  requireAuth.mockImplementation((req, res, next) => {
    req.user = { id: "test-user-123" };
    req.accessToken = "mock-access-token";
    next();
  });
});


describe("SCRUM-231: Summary persistence", () => {
  it("saves a valid summary successfully", async () => {
    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Encapsulation hides internal state.",
        summary: "Encapsulation protects object data.",
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      id: "summary-test-123",
      createdAt: "2026-10-15T12:00:00Z",
      message: "Summary saved successfully.",
    });
  });

  it("rejects missing source text", async () => {
    const response = await request(app)
      .post("/api/summaries")
      .send({
        summary: "A generated summary.",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Source text and summary are required."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects missing summary", async () => {
    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Study material.",
      });

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only input", async () => {
    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "   ",
        summary: "   ",
      });

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects non-string input", async () => {
    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: 123,
        summary: ["invalid"],
      });

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("associates the summary with the authenticated user", async () => {
    await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Study material.",
        summary: "Generated summary.",
      });

    expect(createUserSupabaseClient).toHaveBeenCalledWith(
      "mock-access-token"
    );

    expect(fromMock).toHaveBeenCalledWith(
      "generated_summaries"
    );

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "test-user-123",
      source_text: "Study material.",
      summary_text: "Generated summary.",
    });
  });

  it("trims whitespace before saving", async () => {
    await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "  Study material.  ",
        summary: "  Generated summary.  ",
      });

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "test-user-123",
      source_text: "Study material.",
      summary_text: "Generated summary.",
    });
  });

  it("rejects unauthenticated requests", async () => {
    requireAuth.mockImplementationOnce(
      (_req, res) => {
        res.status(401).json({
          error: "Authentication required.",
        });
      }
    );

    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Study material.",
        summary: "Generated summary.",
      });

    expect(response.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handles Supabase insert failures", async () => {
    insertMock.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: null,
          error: {
            message: "Database unavailable",
          },
        }),
      }),
    });

    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Study material.",
        summary: "Generated summary.",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unable to save summary.",
    });
  });

  it("handles unexpected database exceptions", async () => {
    createUserSupabaseClient.mockImplementationOnce(
      () => {
        throw new Error("Unexpected database failure");
      }
    );

    const response = await request(app)
      .post("/api/summaries")
      .send({
        sourceText: "Study material.",
        summary: "Generated summary.",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected server error.",
    });
  });
});

describe("SCRUM-232: Saved summary retrieval", () => {
  it("retrieves saved summaries successfully", async () => {
    const response = await request(app)
      .get("/api/summaries");

    expect(response.status).toBe(200);

    expect(response.body.summaries).toHaveLength(2);

    expect(response.body.summaries[0]).toEqual({
      id: "summary-1",
      sourceText: "Encapsulation hides data.",
      summary: "Encapsulation protects data.",
      createdAt: "2026-10-15T12:00:00Z",
    });
  });

  it("returns an empty array when no summaries exist", async () => {
    orderMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await request(app)
      .get("/api/summaries");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      summaries: [],
    });
  });

  it("rejects unauthenticated retrieval requests", async () => {
    requireAuth.mockImplementationOnce(
      (_req, res) => {
        res.status(401).json({
          error: "Authentication required.",
        });
      }
    );

    const response = await request(app)
      .get("/api/summaries");

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("filters summaries by authenticated user", async () => {
    await request(app)
      .get("/api/summaries");

    expect(createUserSupabaseClient).toHaveBeenCalledWith(
      "mock-access-token"
    );

    expect(fromMock).toHaveBeenCalledWith(
      "generated_summaries"
    );

    expect(getSelectMock).toHaveBeenCalledWith(
      "id, source_text, summary_text, created_at"
    );

    expect(eqMock).toHaveBeenCalledWith(
      "user_id",
      "test-user-123"
    );
  });

  it("requests summaries in newest-first order", async () => {
    await request(app)
      .get("/api/summaries");

    expect(orderMock).toHaveBeenCalledWith(
      "created_at",
      { ascending: false }
    );
  });

  it("handles Supabase retrieval failures", async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Database unavailable",
      },
    });

    const response = await request(app)
      .get("/api/summaries");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: "Unable to retrieve summaries.",
    });
  });
});
