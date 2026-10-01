import express from "express";
import cors from "cors";
import multer from "multer";
import cookieParser from "cookie-parser";
import path from "node:path";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import {
  randomUUID,
} from "node:crypto";

import {
  DocumentStore,
} from "./documentStore.js";

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

import {
  createUserSupabaseClient,
} from "./config/supabase.js";

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

  const store =
    new DocumentStore(dataDir);

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
        const documents =
          await store.listForUser(
            req.user.id
          );

        documents.sort(
          (a, b) =>
            new Date(b.uploadedAt) -
            new Date(a.uploadedAt)
        );

        res.json({
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


        const document = {
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

          uploadedAt:
            new Date()
              .toISOString(),

          status,

          extractionError,

          textLength:
            extractedText.length,

          storedFilename,

          extractedText,
        };


        await store.add(
          document
        );

        return res
          .status(201)
          .json({
            document:
              publicDocument(
                document
              ),
          });
      } catch (error) {
        next(error);
      }
    }
  );

  


// ===== FLASHCARD ENDPOINTS (Sprint 2 / FLASH-5) =====

// Validate required Flashcard input
const validateFlashcardInput = (req, res, next) => {
    const { topic_id, front, back } = req.body;

    if (
        !topic_id ||
        typeof topic_id !== "string" ||
        topic_id.trim() === ""
    ) {
        return res.status(400).json({
            error: "topic_id is required"
        });
    }

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
                query = query.eq(
                    "topic_id",
                    req.query.topic_id
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
                        req.params.id
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
