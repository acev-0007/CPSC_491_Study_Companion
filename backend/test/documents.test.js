import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createApp } from "../src/app.js";

async function makePdf(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 720, size: 12, font });
  return Buffer.from(await pdf.save());
}

describe("document API", () => {
  let tempRoot;
  let app;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "textbook-hub-test-"));
    app = createApp({
      dataDir: path.join(tempRoot, "data"),
      uploadDir: path.join(tempRoot, "uploads"),
    });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("uploads and extracts a valid TXT file", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-1")
      .attach("file", Buffer.from("Operating systems manage hardware resources."), {
        filename: "os-notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("ready");
    expect(response.body.document.type).toBe("txt");
    expect(response.body.document.textLength).toBeGreaterThan(0);
  });

  it("uploads and extracts a valid digital PDF", async () => {
    const pdf = await makePdf("Virtual memory allows processes to use logical address spaces.");
    const response = await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-1")
      .attach("file", pdf, {
        filename: "virtual-memory.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("ready");
    expect(response.body.document.type).toBe("pdf");
    expect(response.body.document.textLength).toBeGreaterThan(0);
  });

  it("rejects an invalid file type", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-1")
      .attach("file", Buffer.from("fake image"), {
        filename: "diagram.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/only txt and pdf/i);
  });

  it("keeps the document but marks it failed when extraction fails", async () => {
    const response = await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-1")
      .attach("file", Buffer.from("this is not a valid pdf"), {
        filename: "broken.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("failed");
    expect(response.body.document.extractionError).toBeTruthy();
  });

  it("returns an uploaded item in the current user's document list", async () => {
    await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-1")
      .attach("file", Buffer.from("Chapter one notes"), {
        filename: "chapter-1.txt",
        contentType: "text/plain",
      });

    // Add another user's document to make sure listing is user-scoped.
    await request(app)
      .post("/api/documents")
      .set("X-User-Id", "student-2")
      .attach("file", Buffer.from("Other student's notes"), {
        filename: "private.txt",
        contentType: "text/plain",
      });

    const response = await request(app)
      .get("/api/documents")
      .set("X-User-Id", "student-1");

    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);
    expect(response.body.documents[0].name).toBe("chapter-1.txt");
    expect(response.body.documents[0]).not.toHaveProperty("extractedText");

    const stored = JSON.parse(
      await readFile(path.join(tempRoot, "data", "documents.json"), "utf8")
    );
    expect(stored[0].extractedText).toContain("Chapter one notes");
  });
});
