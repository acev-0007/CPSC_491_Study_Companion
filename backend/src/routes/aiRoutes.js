import { Router } from "express";
import { generateClaudeResponse } from "../providers/claudeProvider.js";

const router = Router();

router.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({
        error: "A prompt is required.",
      });
    }

    const response = await generateClaudeResponse(prompt);

    return res.json({
      response,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
