-- SCRUM-128: Trusted quiz identity
--
-- Stores a server-side snapshot of every generated quiz (questions + answer
-- key) so completed attempts can be graded from trusted data instead of
-- from whatever the browser sends.
--
-- Run AFTER 20261119_create_quiz_history.sql.

CREATE TABLE IF NOT EXISTS public.generated_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT 'General',
  -- [{ id, question, options: [{ id, text }], correctOptionId, category }]
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT generated_quiz_questions_valid
    CHECK (
      jsonb_typeof(questions) = 'array'
      AND jsonb_array_length(questions) > 0
    )
);

CREATE INDEX IF NOT EXISTS generated_quizzes_user_idx
ON public.generated_quizzes(user_id, created_at DESC);

ALTER TABLE public.generated_quizzes
ENABLE ROW LEVEL SECURITY;

-- Answer keys are never exposed through the authenticated REST API.
-- Only the backend service-role client may create or read snapshots.
DROP POLICY IF EXISTS "Users can read their own generated quizzes"
ON public.generated_quizzes;
DROP POLICY IF EXISTS "Users can store their own generated quizzes"
ON public.generated_quizzes;
REVOKE ALL ON TABLE public.generated_quizzes FROM PUBLIC, anon, authenticated;
-- Do not create SELECT/INSERT/UPDATE/DELETE policies for students.

-- Link attempts to the quiz they were taken against. SET NULL keeps the
-- history (every attempt stores its own answer snapshot) if a quiz is removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quiz_attempts_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_quiz_id_fkey
      FOREIGN KEY (quiz_id)
      REFERENCES public.generated_quizzes(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Retry safety: one client-generated key per completion. A retried save
-- with the same key returns the original attempt instead of a duplicate.
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_idempotency_idx
ON public.quiz_attempts(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_idx
ON public.quiz_attempts(quiz_id);
