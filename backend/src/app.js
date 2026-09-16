import express from "express";
import multer from "multer";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { DocumentStore } from "./documentStore.js";
import { extractText, validateSupportedFile } from "./extractText.js";
import aiRoutes from "./routes/aiRoutes.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function publicDocument(document) {
  const { extractedText, storedFilename, userId, ...metadata } = document;
  return metadata;
}

export function createApp({
  dataDir = path.resolve("data"),
  uploadDir = path.resolve("data/uploads"),
} = {}) {
  const app = express();
  const store = new DocumentStore(dataDir);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  });

  app.use(express.json());

  app.use("/api/ai", aiRoutes);

  // Temporary auth shim for Sprint 1. The frontend sends X-User-Id: local-user.
  // Replace this with req.user.id when the team's real auth backend is available.
  app.use((req, _res, next) => {
    req.userId = req.get("X-User-Id") || "local-user";
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/documents", async (req, res, next) => {
    try {
      const documents = await store.listForUser(req.userId);
      documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      res.json({ documents: documents.map(publicDocument) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "A file is required." });
      }

      let extension;
      try {
        extension = validateSupportedFile(req.file);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      await mkdir(uploadDir, { recursive: true });

      const id = randomUUID();
      const storedFilename = `${id}${extension}`;
      await writeFile(path.join(uploadDir, storedFilename), req.file.buffer);

      let extractedText = "";
      let status = "ready";
      let extractionError = null;

      try {
        extractedText = await extractText(req.file);
      } catch (error) {
        status = "failed";
        extractionError = error.message || "Text extraction failed.";
      }

      const document = {
        id,
        userId: req.userId,
        name: req.file.originalname,
        type: extension.slice(1),
        mimeType: req.file.mimetype || null,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        status,
        extractionError,
        textLength: extractedText.length,
        storedFilename,
        extractedText,
      };

      await store.add(document);
      return res.status(201).json({ document: publicDocument(document) });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File is too large. Maximum size is 10 MB." });
    }

    console.error(error);
    return res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}
