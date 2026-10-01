import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import request from "supertest";

import {
  access,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  PDFDocument,
  StandardFonts,
} from "pdf-lib";

import { createApp } from "../src/app.js";

import {
  ACCESS_COOKIE,
} from "../src/auth/sessionCookies.js";

vi.mock("../src/config/supabase.js", () => ({
  createSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (accessToken) => {
        const users = {
          "student-1-token": { id: "student-1" },
          "student-2-token": { id: "student-2" },
        };

        const user = users[accessToken];

        if (user) {
          return {
            data: { user },
            error: null,
          };
        }

        return {
          data: { user: null },
          error: new Error("Invalid test token"),
        };
      }),

      refreshSession: vi.fn(),
    },
  })),
}));

async function makePdf(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawText(text, {
    x: 72,
    y: 720,
    size: 12,
    font,
  });

  return Buffer.from(await pdf.save());
}

describe("document API", () => {
  let tempRoot;
  let app;

  beforeEach(async () => {
    tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "textbook-hub-test-")
    );

    app = createApp({
      dataDir: path.join(tempRoot, "data"),
      uploadDir: path.join(tempRoot, "uploads"),
    });
  });

  afterEach(async () => {
    await rm(tempRoot, {
      recursive: true,
      force: true,
    });
  });

  it("uploads and extracts a valid TXT file", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from(
          "Operating systems manage hardware resources."
        ),
        {
          filename: "os-notes.txt",
          contentType: "text/plain",
        }
      );

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("ready");
    expect(response.body.document.type).toBe("txt");
    expect(
      response.body.document.textLength
    ).toBeGreaterThan(0);
  });

  it("rejects document access without authentication", async () => {
    const response = await request(app)
      .get("/api/documents");

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(
      /authentication required/i
    );
  });

  it("uploads and extracts a valid digital PDF", async () => {
    const pdf = await makePdf(
      "Virtual memory allows processes to use logical address spaces."
    );

    const response = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach("file", pdf, {
        filename: "virtual-memory.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("ready");
    expect(response.body.document.type).toBe("pdf");
    expect(
      response.body.document.textLength
    ).toBeGreaterThan(0);
  });

  it("rejects an invalid file type", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("fake image"),
        {
          filename: "diagram.png",
          contentType: "image/png",
        }
      );

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(
      /only txt and pdf/i
    );
  });

  it("keeps the document but marks it failed when extraction fails", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("this is not a valid pdf"),
        {
          filename: "broken.pdf",
          contentType: "application/pdf",
        }
      );

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("failed");
    expect(
      response.body.document.extractionError
    ).toBeTruthy();
  });

  it("returns an uploaded item in the current user's document list", async () => {
    await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("Chapter one notes"),
        {
          filename: "chapter-1.txt",
          contentType: "text/plain",
        }
      );

    await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`)
      .attach(
        "file",
        Buffer.from("Other student's notes"),
        {
          filename: "private.txt",
          contentType: "text/plain",
        }
      );

    const response = await request(app)
      .get("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);

    expect(response.body.documents[0].name).toBe(
      "chapter-1.txt"
    );

    expect(
      response.body.documents[0]
    ).not.toHaveProperty("extractedText");

    const stored = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(stored[0].extractedText).toContain(
      "Chapter one notes"
    );
  });

  it("updates document metadata", async () => {
    const uploadResponse = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .field("category", "Study Guide")
      .field("course", "CPSC 491")
      .attach(
        "file",
        Buffer.from("Chapter one notes"),
        {
          filename: "chapter-1.txt",
          contentType: "text/plain",
        }
      );

    expect(uploadResponse.status).toBe(201);

    const documentId =
      uploadResponse.body.document.id;

    const response = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({
        name: "chapter-1-review.txt",
        category: "Lecture Notes",
        course: "CPSC 491 Software Engineering",
      });

    expect(response.status).toBe(200);

    expect(response.body.document.name).toBe(
      "chapter-1-review.txt"
    );

    expect(response.body.document.category).toBe(
      "Lecture Notes"
    );

    expect(response.body.document.course).toBe(
      "CPSC 491 Software Engineering"
    );

    const stored = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(stored[0].name).toBe(
      "chapter-1-review.txt"
    );

    expect(stored[0].category).toBe(
      "Lecture Notes"
    );

    expect(stored[0].course).toBe(
      "CPSC 491 Software Engineering"
    );
  });

  it("normalizes a cleared course to Unassigned", async () => {
    const uploadResponse = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .field("course", "CPSC 491")
      .attach(
        "file",
        Buffer.from("Course notes"),
        {
          filename: "course-notes.txt",
          contentType: "text/plain",
        }
      );

    expect(uploadResponse.status).toBe(201);

    const documentId =
      uploadResponse.body.document.id;

    const response = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .send({
        course: "",
      });

    expect(response.status).toBe(200);

    expect(response.body.document.course).toBe(
      "Unassigned"
    );

    const stored = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(stored[0].course).toBe(
      "Unassigned"
    );
  });

  it("does not allow a user to update another user's document", async () => {
    const uploadResponse = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("Private notes"),
        {
          filename: "private.txt",
          contentType: "text/plain",
        }
      );

    expect(uploadResponse.status).toBe(201);

    const documentId =
      uploadResponse.body.document.id;

    const response = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`)
      .send({
        name: "stolen-name.txt",
      });

    expect(response.status).toBe(404);

    const stored = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(stored[0].name).toBe(
      "private.txt"
    );
  });

  it("deletes an owned document and its uploaded file", async () => {
    const uploadResponse = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("Temporary notes"),
        {
          filename: "temporary.txt",
          contentType: "text/plain",
        }
      );

    expect(uploadResponse.status).toBe(201);

    const documentId =
      uploadResponse.body.document.id;

    const beforeDelete = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(beforeDelete).toHaveLength(1);

    const storedFilename =
      beforeDelete[0].storedFilename;

    const storedFilePath = path.join(
      tempRoot,
      "uploads",
      storedFilename
    );

    await expect(
      access(storedFilePath)
    ).resolves.toBeUndefined();

    const response = await request(app)
      .delete(`/api/documents/${documentId}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`);

    expect(response.status).toBe(200);

    expect(response.body.document.id).toBe(
      documentId
    );

    const afterDelete = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(afterDelete).toHaveLength(0);

    await expect(
      access(storedFilePath)
    ).rejects.toThrow();
  });

  it("does not allow a user to delete another user's document", async () => {
    const uploadResponse = await request(app)
      .post("/api/documents")
      .set("Cookie", `${ACCESS_COOKIE}=student-1-token`)
      .attach(
        "file",
        Buffer.from("Private document"),
        {
          filename: "private.txt",
          contentType: "text/plain",
        }
      );

    expect(uploadResponse.status).toBe(201);

    const documentId =
      uploadResponse.body.document.id;

    const response = await request(app)
      .delete(`/api/documents/${documentId}`)
      .set("Cookie", `${ACCESS_COOKIE}=student-2-token`);

    expect(response.status).toBe(404);

    const stored = JSON.parse(
      await readFile(
        path.join(
          tempRoot,
          "data",
          "documents.json"
        ),
        "utf8"
      )
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(documentId);
  });
});