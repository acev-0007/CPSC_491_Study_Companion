
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

export default router;
