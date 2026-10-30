import express from "express";
import cors from "cors";
import multer from "multer";
import cookieParser from "cookie-parser";
import path from "node:path";
import { DocumentContentService } from "./documentContentService.js";

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

import summaryRoutes
  from "./routes/summaryRoutes.js";

import {
  requireAuth,
} from "./middleware/requireAuth.js";

import {
  createUserSupabaseClient,
} from "./config/supabase.js";

import assignmentRoutes
  from "./routes/assignmentRoutes.js";


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

  app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
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

  // AI generation requires a verified session before any provider is called.
  // Protect at the mount point to avoid changing the AI route handlers.
  app.use(
    "/api/ai",
    requireAuth,
    aiRoutes
  );


  // ========================================
  // SUMMARY PERSISTENCE ROUTES (SCRUM-231)
  // ========================================

  app.use(
    "/api/summaries",
    summaryRoutes
  );


  // ========================================
  // CREATE TOPIC (FLASH-TEST-1)
  // ========================================
  //
  // Creates a user-owned topic for a generated
  // flashcard deck. The database generates the UUID.
  // Ownership is derived from the authenticated session.

  app.post(
    "/api/topics",
    requireAuth,
    async (req, res) => {
      const { title, source_text } = req.body ?? {};

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 255
      ) {
        return res.status(400).json({
          error: "A topic title (1-255 characters) is required.",
        });
      }

      if (
        source_text !== undefined &&
        source_text !== null &&
        typeof source_text !== "string"
      ) {
        return res.status(400).json({
          error: "source_text must be a string.",
        });
      }

      try {
        const supabase = createUserSupabaseClient(
          req.accessToken
        );

        const newTopic = {
          user_id: req.user.id,
          title: title.trim(),
          source_text:
            typeof source_text === "string"
              ? source_text
              : null,
        };

        const { data, error } = await supabase
          .from("topics")
          .insert(newTopic)
          .select("id, user_id, title, source_text")
          .single();

        if (error) {
          throw error;
        }

        if (!data?.id) {
          throw new Error(
            "Topic creation returned no ID."
          );
        }

        return res.status(201).json(data);
      } catch (error) {
        console.error("Error creating topic:", error);

        return res.status(500).json({
          error: "Failed to create topic.",
        });
      }
    }
  );


  // ========================================
  // LIST TOPICS (FLASH-DECK-1)
  // ========================================
  //
  // Returns the authenticated user's saved decks, newest
  // first, with a flashcard count for each. Ownership is
  // enforced twice: an explicit user_id filter here and
  // the Supabase row-level security policy.

  app.get(
    "/api/topics",
    requireAuth,
    async (req, res) => {
      try {
        const supabase = createUserSupabaseClient(
          req.accessToken
        );

        const { data, error } = await supabase
          .from("topics")
          .select("id, title, created_at, flashcards(count)")
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const topics = (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          created_at: row.created_at,
          card_count: row.flashcards?.[0]?.count ?? 0,
        }));

        return res.status(200).json({ topics });
      } catch (error) {
        console.error("Error listing topics:", error);

        return res.status(500).json({
          error: "Failed to fetch topics.",
        });
      }
    }
  );


  // ========================================
  // DELETE TOPIC (FLASH-DECK-1)
  // ========================================
  //
  // Deletes one user-owned topic. The flashcards.topic_id
  // foreign key is ON DELETE CASCADE, so the database
  // removes the topic's flashcards; they are not deleted
  // individually here.
  //
  //   400  malformed UUID
  //   404  topic does not exist or is not owned by the user
  //   204  deleted

  app.delete(
    "/api/topics/:id",
    requireAuth,
    async (req, res) => {
      if (!isValidUUID(req.params.id)) {
        return res.status(400).json({
          error: "Topic id must be a valid UUID.",
        });
      }

      try {
        const supabase = createUserSupabaseClient(
          req.accessToken
        );

        const { data, error } = await supabase
          .from("topics")
          .delete()
          .eq("id", req.params.id.trim())
          .eq("user_id", req.user.id)
          .select("id");

        if (error) {
          throw error;
        }

        // Row-level security can make a delete match zero rows
        // without an error, so confirm something was removed.
        if (!data || data.length === 0) {
          return res.status(404).json({
            error: "Topic not found.",
          });
        }

        return res.status(204).end();
      } catch (error) {
        console.error("Error deleting topic:", error);

        return res.status(500).json({
          error: "Failed to delete topic.",
        });
      }
    }
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
  // GET AI-READY DOCUMENT CONTENT
  // ========================================

  app.get(
    "/api/documents/:id/ai-content",
    requireAuth,

    async (req, res, next) => {
      try {
        const contentService =
          new DocumentContentService(
            req.accessToken
          );

        const content =
          await contentService
            .getAiReadyContent(
              req.params.id,
              req.user.id
            );


        // Missing, deleted, or not owned by user.
        if (!content) {
          return res
            .status(404)
            .json({
              error:
                "Document not found.",
            });
        }


        // Document exists but is not finished yet.
        if (
          content.status ===
          "processing"
        ) {
          return res
            .status(409)
            .json({
              error:
                "Document is still processing.",
              status:
                "processing",
            });
        }


        // Extraction or chunk persistence failed.
        if (
          content.status ===
          "failed"
        ) {
          return res
            .status(422)
            .json({
              error:
                "Document content is unavailable because processing failed.",
              status:
                "failed",
            });
        }

        if (
          content.status !==
          "ready"
        ) {
          return res
            .status(409)
            .json({
              error:
                "Document content is not ready.",
              status:
                content.status,
            });
        }

        return res
          .status(200)
          .json({
            documentId:
              content.documentId,

            name:
              content.name,

            status:
              content.status,

            text:
              content.text,

            chunks:
              content.chunks,
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
              extractedText,
              {
                sentenceAware:
                  true,
              }
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





// ===== FLASHCARD ENDPOINTS (Sprint 2 / FLASH-5) =====

// Validate UUIDs before passing user-controlled values to PostgreSQL UUID columns.
// PostgreSQL accepts the canonical 8-4-4-4-12 hexadecimal UUID shape regardless
// of UUID version, so do not unnecessarily restrict the version nibble here.
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (value) =>
    typeof value === "string" &&
    UUID_REGEX.test(value.trim());

// Validate required Flashcard input
const validateFlashcardInput = (req, res, next) => {
    const { topic_id, front, back } = req.body;

    if (!topic_id || typeof topic_id !== "string" || topic_id.trim() === "") {
        return res.status(400).json({
            error: "topic_id is required"
        });
    }

    if (!isValidUUID(topic_id)) {
        return res.status(400).json({
            error: "topic_id must be a valid UUID"
        });
    }

    // Use the normalized value for the later Supabase query/insert.
    req.body.topic_id = topic_id.trim();

    if (
        !front ||
        typeof front !== "string" ||
        front.trim() === ""
    ) {
        return res.status(400).json({
            error: "Front can't be empty"
        });
    }

    if (
        !back ||
        typeof back !== "string" ||
        back.trim() === ""
    ) {
        return res.status(400).json({
            error: "Back can't be empty"
        });
    }

    next();
};


// READ ALL FLASHCARDS
// Returns only Flashcards owned by the authenticated user.
// Optional ?topic_id=<uuid> filters cards by Topic.
app.get(
    "/api/flashcards",
    requireAuth,
    async (req, res) => {
        try {
            const supabase =
                createUserSupabaseClient(
                    req.accessToken
                );

            let query = supabase
                .from("flashcards")
                .select("*")
                .eq("user_id", req.user.id)
                .order(
                    "created_at",
                    { ascending: true }
                );

            if (req.query.topic_id) {
                if (!isValidUUID(req.query.topic_id)) {
                    return res.status(400).json({
                        error: "topic_id must be a valid UUID"
                    });
                }

                query = query.eq(
                    "topic_id",
                    req.query.topic_id.trim()
                );
            }

            const { data, error } =
                await query;

            if (error) {
                throw error;
            }

            // Empty collections are valid.
            return res.status(200).json({
                flashcards: data || []
            });

        } catch (error) {
            console.error(
                "Error fetching flashcards:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to fetch flashcards"
            });
        }
    }
);


// READ ONE FLASHCARD
app.get(
    "/api/flashcards/:id",
    requireAuth,
    async (req, res) => {
        try {
            if (!isValidUUID(req.params.id)) {
                return res.status(400).json({
                    error: "Flashcard id must be a valid UUID"
                });
            }

            const supabase =
                createUserSupabaseClient(
                    req.accessToken
                );

            const { data, error } =
                await supabase
                    .from("flashcards")
                    .select("*")
                    .eq(
                        "id",
                        req.params.id.trim()
                    )
                    .eq(
                        "user_id",
                        req.user.id
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                return res.status(404).json({
                    error:
                        "Flashcard not found"
                });
            }

            return res
                .status(200)
                .json(data);

        } catch (error) {
            console.error(
                "Error fetching flashcard:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to fetch flashcard"
            });
        }
    }
);


// CREATE FLASHCARD
app.post(
    "/api/flashcards",
    requireAuth,
    validateFlashcardInput,
    async (req, res) => {
        try {
            const supabase =
                createUserSupabaseClient(
                    req.accessToken
                );

            /*
             * Verify that the requested Topic belongs
             * to the authenticated user.
             *
             * The foreign key guarantees that a Topic
             * exists, but does not by itself guarantee
             * that the Topic belongs to this user.
             */
            const {
                data: topic,
                error: topicError
            } = await supabase
                .from("topics")
                .select("id")
                .eq(
                    "id",
                    req.body.topic_id
                )
                .eq(
                    "user_id",
                    req.user.id
                )
                .maybeSingle();

            if (topicError) {
                throw topicError;
            }

            if (!topic) {
                return res.status(400).json({
                    error: "Invalid topic_id"
                });
            }

            /*
             * Ownership comes from the authenticated
             * session, not from req.body.
             */
            const newFlashcard = {
                topic_id:
                    req.body.topic_id,

                user_id:
                    req.user.id,

                front:
                    req.body.front.trim(),

                back:
                    req.body.back.trim()
            };

            const { data, error } =
                await supabase
                    .from("flashcards")
                    .insert(newFlashcard)
                    .select();

            if (error) {
                throw error;
            }

            if (
                !data ||
                data.length === 0
            ) {
                throw new Error(
                    "Flashcard insert returned no data"
                );
            }

            return res
                .status(201)
                .json(data[0]);

        } catch (error) {
            console.error(
                "Error creating flashcard:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to create flashcard"
            });
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

  // ========================================
  // ASSIGNMENT TRACKER ROUTE
  // ========================================

  app.use(
    "/api/assignments",
    assignmentRoutes
  );

  return app;
}
