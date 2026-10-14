import { Router } from "express";
import { generateClaudeResponse } from "../providers/claudeProvider.js";

const router = Router();

router.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
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

router.post("/summarize", async (req, res, next) => {
  try {
    const { notes } = req.body;

    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({
        error: "Study material is required.",
      });
    }

    const prompt = `
Summarize the following study material clearly and concisely.
Focus on the main ideas and important details that would help a college student study.

Study material:
${notes.trim()}
    `.trim();

    const summary = await generateClaudeResponse(prompt);

    return res.json({
      summary,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
