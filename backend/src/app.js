import express from "express";
import multer from "multer";
import cookieParser from "cookie-parser";
import path from "node:path";

import {
  chunkDocumentText,
} from "./documentChunker.js";

import {
  mkdir,
  writeFile,
  unlink,
} from "node:fs/promises";

import {
  randomUUID,
} from "node:crypto";

import {
  SupabaseDocumentStore,
} from "./supabaseDocumentStore.js";

import {
  extractText,
  validateSupportedFile,
} from "./extractText.js";

import authRoutes
  from "./routes/authRoutes.js";

import aiRoutes
  from "./routes/aiRoutes.js";

import {
  requireAuth,
} from "./middleware/requireAuth.js";


const MAX_FILE_SIZE =
  10 * 1024 * 1024;


function publicDocument(document) {
  const {
    extractedText,
    storedFilename,
    userId,
    ...metadata
  } = document;

  return metadata;
}


export function createApp({
  dataDir =
    path.resolve("data"),

  uploadDir =
    path.resolve(
      "data/uploads"
    ),
} = {}) {

  const app = express();

  /*
   * dataDir is retained temporarily because existing
   * tests still pass it into createApp().
   *
   * Document metadata persistence now uses Supabase.
   */
  void dataDir;


  const upload =
    multer({
      storage:
        multer.memoryStorage(),

      limits: {
        fileSize:
          MAX_FILE_SIZE,
      },
    });


  // ========================================
  // GLOBAL MIDDLEWARE
  // ========================================

  app.use(express.json());
  app.use(cookieParser());


  // ========================================
  // AUTH ROUTES
  // ========================================

  app.use(
    "/api/auth",
    authRoutes
  );


  // ========================================
  // AI ROUTES
  // ========================================

  app.use(
    "/api/ai",
    aiRoutes
  );


  // ========================================
  // HEALTH CHECK
  // ========================================

  app.get(
    "/api/health",
    (_req, res) => {
      res.json({
        status: "ok",
      });
    }
  );


  // ========================================
  // LIST DOCUMENTS
  // ========================================

  app.get(
    "/api/documents",
    requireAuth,

    async (req, res, next) => {
      try {
        const store =
          new SupabaseDocumentStore(
            req.accessToken
          );

        const documents =
          await store.listForUser(
            req.user.id
          );

        return res.json({
          documents:
            documents.map(
              publicDocument
            ),
        });
      } catch (error) {
        next(error);
      }
    }
  );


  // ========================================
  // UPLOAD DOCUMENT
  // ========================================

  app.post(
    "/api/documents",
    requireAuth,
    upload.single("file"),

    async (req, res, next) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({
              error:
                "A file is required.",
            });
        }


        let extension;

        try {
          extension =
            validateSupportedFile(
              req.file
            );
        } catch (error) {
          return res
            .status(400)
            .json({
              error:
                error.message,
            });
        }


        const store =
          new SupabaseDocumentStore(
            req.accessToken
          );


        await mkdir(
          uploadDir,
          {
            recursive: true,
          }
        );


        const id =
          randomUUID();

        const storedFilename =
          `${id}${extension}`;


        await writeFile(
          path.join(
            uploadDir,
            storedFilename
          ),

          req.file.buffer
        );


        // ----------------------------------------
        // CREATE INITIAL PROCESSING RECORD
        // ----------------------------------------

        const processingDocument = {
          id,

          userId:
            req.user.id,

          name:
            req.file.originalname,

          type:
            extension.slice(1),

          mimeType:
            req.file.mimetype ||
            null,

          size:
            req.file.size,

          category:
            req.body.category ||
            "Other",

          course:
            req.body.course?.trim() ||
            "Unassigned",

          uploadedAt:
            new Date()
              .toISOString(),

          status:
            "processing",

          extractionError:
            null,

          textLength:
            0,

          storedFilename,

          extractedText:
            "",
        };


        try {
          await store.add(
            processingDocument
          );
        } catch (error) {
          try {
            await unlink(
              path.join(
                uploadDir,
                storedFilename
              )
            );
          } catch (cleanupError) {
            if (
              cleanupError.code !==
              "ENOENT"
            ) {
              console.error(
                "Failed to clean up orphaned upload:",
                storedFilename,
                cleanupError
              );
            }
          }

          throw error;
        }


        // ----------------------------------------
        // EXTRACT TEXT
        // ----------------------------------------

        let extractedText = "";
        let status = "ready";
        let extractionError = null;


        try {
          extractedText =
            await extractText(
              req.file
            );
        } catch (error) {
          status = "failed";

          extractionError =
            error.message ||
            "Text extraction failed.";
        }


        // ----------------------------------------
        // HANDLE EXTRACTION FAILURE
        // ----------------------------------------

        if (status === "failed") {
          const failedDocument =
            await store.updateProcessingState(
              id,
              req.user.id,
              {
                status:
                  "failed",

                extractionError,

                textLength:
                  0,

                extractedText:
                  "",
              }
            );


          if (!failedDocument) {
            throw new Error(
              "Document processing record could not be updated."
            );
          }


          return res
            .status(201)
            .json({
              document:
                publicDocument(
                  failedDocument
                ),
            });
        }


        // ----------------------------------------
        // SAVE EXTRACTED CONTENT WHILE PROCESSING
        // ----------------------------------------

        const processingDocumentWithText =
          await store.updateProcessingState(
            id,
            req.user.id,
            {
              status:
                "processing",

              extractionError:
                null,

              textLength:
                extractedText.length,

              extractedText,
            }
          );


        if (!processingDocumentWithText) {
          throw new Error(
            "Document processing record could not be updated."
          );
        }


        // ----------------------------------------
        // CREATE AI-READY CHUNKS
        // ----------------------------------------

        try {
          const chunks =
            chunkDocumentText(
              extractedText
            );


          await store
            .replaceChunksForDocument(
              id,
              chunks
            );
        } catch (error) {
          await store.updateProcessingState(
            id,
            req.user.id,
            {
              status:
                "failed",

              extractionError:
                "Chunk persistence failed.",

              textLength:
                extractedText.length,

              extractedText,
            }
          );

          throw error;
        }


        // ----------------------------------------
        // MARK DOCUMENT READY
        // ----------------------------------------

        const readyDocument =
          await store.updateProcessingState(
            id,
            req.user.id,
            {
              status:
                "ready",

              extractionError:
                null,

              textLength:
                extractedText.length,

              extractedText,
            }
          );


        if (!readyDocument) {
          throw new Error(
            "Document processing record could not be updated."
          );
        }


        return res
          .status(201)
          .json({
            document:
              publicDocument(
                readyDocument
              ),
          });

      } catch (error) {
        next(error);
      }
    }
  );
          


  // ========================================
  // UPDATE DOCUMENT METADATA
  // ========================================

  app.patch(
    "/api/documents/:id",
    requireAuth,

    async (req, res, next) => {
      try {
        const store =
          new SupabaseDocumentStore(
            req.accessToken
          );

        const updatedDocument =
          await store.updateForUser(
            req.params.id,
            req.user.id,
            {
              name:
                req.body.name?.trim(),

              category:
                req.body.category?.trim(),

              course:
                req.body.course?.trim(),
            }
          );


        if (!updatedDocument) {
          return res
            .status(404)
            .json({
              error:
                "Document not found.",
            });
        }


        return res.json({
          document:
            publicDocument(
              updatedDocument
            ),
        });
      } catch (error) {
        next(error);
      }
    }
  );


  // ========================================
  // DELETE DOCUMENT
  // ========================================

  app.delete(
    "/api/documents/:id",
    requireAuth,

    async (req, res, next) => {
      try {
        const store =
          new SupabaseDocumentStore(
            req.accessToken
          );

        const deletedDocument =
          await store.deleteForUser(
            req.params.id,
            req.user.id
          );


        if (!deletedDocument) {
          return res
            .status(404)
            .json({
              error:
                "Document not found.",
            });
        }


        if (
          deletedDocument.storedFilename
        ) {
          try {
            await unlink(
              path.join(
                uploadDir,
                deletedDocument.storedFilename
              )
            );
          } catch (error) {
            if (
              error.code !== "ENOENT"
            ) {
              console.error(
                "Failed to remove uploaded file:",
                deletedDocument.storedFilename,
                error
              );
            }
          }
        }


        return res.json({
          document:
            publicDocument(
              deletedDocument
            ),
        });
      } catch (error) {
        next(error);
      }
    }
  );


  // ========================================
  // ERROR HANDLING
  // ========================================

  app.use(
    (error, _req, res, _next) => {

      if (
        error instanceof
        multer.MulterError &&
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(413)
          .json({
            error:
              "File is too large. Maximum size is 10 MB.",
          });
      }


      console.error(error);


      return res
        .status(500)
        .json({
          error:
            "Unexpected server error.",
        });
    }
  );


  return app;
}