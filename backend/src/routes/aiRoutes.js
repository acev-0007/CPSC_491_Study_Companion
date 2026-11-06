
import { Router } from "express";
import { generateClaudeResponse } from "../providers/claudeProvider.js";
import { parseQuiz } from "../quizValidator.js"; 

const router = Router();
const MAX_FLASHCARD_TEXT_LENGTH = 20000;

router.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body ?? {};

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
    const { notes } = req.body ?? {};

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


router.post("/flashcards", async (req, res, next) => {
  try {
    const { notes } = req.body ?? {};

    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({
        error: "Study material is required.",
      });
    }

    if (notes.trim().length > MAX_FLASHCARD_TEXT_LENGTH) {
      return res.status(400).json({
        error: "Study material cannot exceed 20,000 characters.",
      });
    }

    const prompt = `
Generate up to 5 useful study flashcards from the following material.

Return ONLY a valid JSON object in this exact format:
{
  "flashcards": [
    {
      "front": "Question",
      "back": "Answer"
    }
  ]
}

Requirements:
- Each flashcard must have a front and back.
- The front should contain a clear study question.
- The back should contain a concise, accurate answer.
- Base all flashcards on the provided study material.
- Do not invent information.
- Do not include Markdown code fences or explanations.
- Return only JSON.

Study material:
${notes.trim()}
    `.trim();

    const response = await generateClaudeResponse(prompt);

    let parsed;

    try {
      parsed = JSON.parse(response);
    } catch {
      return res.status(502).json({
        error: "Flashcard generation failed.",
      });
    }

    if (
      !parsed ||
      !Array.isArray(parsed.flashcards) ||
      parsed.flashcards.length === 0 ||
      !parsed.flashcards.every(
        (card) =>
          card &&
          typeof card.front === "string" &&
          card.front.trim().length > 0 &&
          typeof card.back === "string" &&
          card.back.trim().length > 0
      )
    ) {
      return res.status(502).json({
        error: "Flashcard generation failed.",
      });
    }

    return res.json({
      flashcards: parsed.flashcards.map((card) => ({
        front: card.front.trim(),
        back: card.back.trim(),
      })),
    });
  } catch (error) {
    next(error);
  }
});
// SCRUM-125: AI quiz generation (exactly 5 multiple-choice questions).
router.post("/quiz", async (req, res, next) => {
  try {
    const { notes } = req.body ?? {};

    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({
        error: "Study material is required.",
      });
    }

    if (notes.trim().length > MAX_FLASHCARD_TEXT_LENGTH) {
      return res.status(400).json({
        error: "Study material cannot exceed 20,000 characters.",
      });
    }

    const prompt = `
Generate exactly 5 multiple-choice quiz questions from the following material.

Return ONLY a valid JSON object in this exact format:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Choice A text", "Choice B text", "Choice C text", "Choice D text"],
      "correctOptionId": "B"
    }
  ]
}

Requirements:
- Exactly 5 questions.
- Each question has exactly 4 distinct options, in the "options" array.
- correctOptionId is the letter of the one correct option: "A", "B", "C", or "D".
- Do not put letters like "A." inside the option text.
- Vary which letter is correct.
- Base all questions on the provided study material.
- Do not invent information.
- Do not include Markdown code fences or explanations.
- Return only JSON.

Study material:
${notes.trim()}
    `.trim();

    // Five questions need more room than the default 1000-token limit.
    const response = await generateClaudeResponse(prompt, 2000);

    const questions = parseQuiz(response);

    if (!questions) {
      return res.status(502).json({
        error: "Quiz generation failed.",
      });
    }

    return res.json({ questions });
  } catch (error) {
    next(error);
  }
});
export default router;
