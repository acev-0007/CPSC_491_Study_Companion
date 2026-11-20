import { createServiceRoleSupabaseClient } from "./config/supabase.js";

// SCRUM-128: stores a server-side snapshot of a generated quiz, including the
// answer key, so a completed attempt can later be graded from trusted data.
//
// Saving is best effort. If it fails, the student still gets their quiz and
// can study normally; the quiz just has no id, so the UI knows the attempt
// cannot be saved to history. A failure is logged, never silently ignored.

/**
 * @returns {Promise<string|null>} The new quiz id, or null if it was not saved.
 */
export async function saveGeneratedQuiz(
  userId,
  topic,
  questions
) {
  try {
    const supabase = createServiceRoleSupabaseClient();

    const { data, error } = await supabase
      .from("generated_quizzes")
      .insert({
        user_id: userId,
        topic,
        questions,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error("Failed to save generated quiz snapshot:", error);
    return null;
  }
}
