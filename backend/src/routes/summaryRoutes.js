
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createUserSupabaseClient } from "../config/supabase.js";

const router = Router();

// Save a generated summary for the logged-in user.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { sourceText, summary } = req.body ?? {};

    if (
      typeof sourceText !== "string" ||
      !sourceText.trim() ||
      typeof summary !== "string" ||
      !summary.trim()
    ) {
      return res.status(400).json({
        error: "Source text and summary are required.",
      });
    }

    const supabase = createUserSupabaseClient(
      req.accessToken
    );

    const { data, error } = await supabase
      .from("generated_summaries")
      .insert({
        user_id: req.user.id,
        source_text: sourceText.trim(),
        summary_text: summary.trim(),
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Failed to save summary:", error);
      return res.status(500).json({
        error: "Unable to save summary.",
      });
    }

    return res.status(201).json({
      id: data.id,
      createdAt: data.created_at,
      message: "Summary saved successfully.",
    });
  } catch (error) {
    next(error);
  }
});


/**
 * SCRUM-232: Retrieve saved summaries
 * belonging to the authenticated user.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const supabase = createUserSupabaseClient(
      req.accessToken
    );

    const { data, error } = await supabase
      .from("generated_summaries")
      .select("id, source_text, summary_text, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to retrieve summaries:", error);

      return res.status(500).json({
        error: "Unable to retrieve summaries.",
      });
    }

    return res.status(200).json({
      summaries: (data ?? []).map((row) => ({
        id: row.id,
        sourceText: row.source_text,
        summary: row.summary_text,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
