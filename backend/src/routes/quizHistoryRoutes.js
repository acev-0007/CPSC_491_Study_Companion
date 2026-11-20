
import { Router } from "express";
import { createUserSupabaseClient } from "../config/supabase.js";

const router = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(value) {
  return typeof value === "string" &&
    UUID_REGEX.test(value);
}

function validAnswers(answers) {
  if (!Array.isArray(answers)) return false;

  if (answers.length < 1 || answers.length > 50) {
    return false;
  }

  const indices = new Set();

  for (const answer of answers) {
    if (
      !answer ||
      !Number.isInteger(answer.questionIndex) ||
      answer.questionIndex < 0 ||
      !["A", "B", "C", "D"].includes(
        answer.selectedOptionId
      )
    ) {
      return false;
    }

    if (indices.has(answer.questionIndex)) {
      return false;
    }

    indices.add(answer.questionIndex);
  }

  return true;
}

// POST /api/quiz-history/attempts
// Submit selected answers for trusted server-side grading.
router.post("/attempts", async (req, res, next) => {
  try {
    const {
      quizId,
      idempotencyKey,
      answers,
    } = req.body ?? {};

    if (
      !isUUID(quizId) ||
      !isUUID(idempotencyKey) ||
      !validAnswers(answers)
    ) {
      return res.status(400).json({
        error: "Invalid quiz submission.",
      });
    }

    const supabase = createUserSupabaseClient(
      req.accessToken
    );

    const { data, error } = await supabase.rpc(
      "submit_quiz_attempt",
      {
        p_quiz_id: quizId,
        p_idempotency_key: idempotencyKey,
        p_answers: answers,
      }
    );

    if (error) {
      if (
        error.message?.includes("quiz_not_found")
      ) {
        return res.status(404).json({
          error: "Quiz not found.",
        });
      }

      if (
        error.message?.includes("invalid_answers") ||
        error.message?.includes("retry_conflict")
      ) {
        return res.status(400).json({
          error: "Invalid quiz submission.",
        });
      }

      console.error(
        "Quiz submission failed:",
        error.code
      );

      return res.status(500).json({
        error: "Failed to save quiz attempt.",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/quiz-history/attempts
// Return the student's previous quiz attempts.
router.get("/attempts", async (req, res, next) => {
  try {
    const supabase = createUserSupabaseClient(
      req.accessToken
    );

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, quiz_id, topic, score_percent, correct_count, total_questions, completed_at"
      )
      .eq("user_id", req.user.id)
      .order("completed_at", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      console.error(
        "Quiz history retrieval failed:",
        error.code
      );

      return res.status(500).json({
        error: "Failed to retrieve quiz history.",
      });
    }

    return res.json({
      attempts: data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/quiz-history/attempts/:attemptId
// Return one attempt with its saved answers.
router.get(
  "/attempts/:attemptId",
  async (req, res, next) => {
    try {
      const { attemptId } = req.params;

      if (!isUUID(attemptId)) {
        return res.status(400).json({
          error: "Invalid attempt ID.",
        });
      }

      const supabase = createUserSupabaseClient(
        req.accessToken
      );

      const { data: attempt, error: attemptError } =
        await supabase
          .from("quiz_attempts")
          .select(
            "id, quiz_id, topic, score_percent, correct_count, total_questions, completed_at"
          )
          .eq("id", attemptId)
          .eq("user_id", req.user.id)
          .maybeSingle();

      if (attemptError) {
        return res.status(500).json({
          error: "Failed to retrieve quiz attempt.",
        });
      }

      if (!attempt) {
        return res.status(404).json({
          error: "Quiz attempt not found.",
        });
      }

      const { data: answers, error: answersError } =
        await supabase
          .from("quiz_attempt_answers")
          .select(
            "question_index, question_text, selected_option_id, correct_option_id, options, category, is_correct"
          )
          .eq("attempt_id", attemptId)
          .order("question_index", {
            ascending: true,
          });

      if (answersError) {
        return res.status(500).json({
          error: "Failed to retrieve quiz answers.",
        });
      }

      return res.json({
        attempt,
        answers: answers ?? [],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
