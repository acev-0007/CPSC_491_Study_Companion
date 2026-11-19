
-- SCRUM-128: Store Quiz Attempts and Scores
-- Creates quiz history tables with ownership and data integrity.
-- Apply to databases where these tables do not already exist.

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID,
  topic TEXT NOT NULL DEFAULT 'General',
  score_percent INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT quiz_score_range
    CHECK (score_percent BETWEEN 0 AND 100),

  CONSTRAINT quiz_counts_valid
    CHECK (
      total_questions > 0
      AND correct_count >= 0
      AND correct_count <= total_questions
    )
);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL
    REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  selected_option_id TEXT,
  correct_option_id TEXT NOT NULL,
  options JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  is_correct BOOLEAN NOT NULL,

  CONSTRAINT unique_attempt_question
    UNIQUE (attempt_id, question_index),

  CONSTRAINT valid_question_index
    CHECK (question_index >= 0)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_date_idx
ON public.quiz_attempts(user_id, completed_at DESC);

ALTER TABLE public.quiz_attempts
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quiz_attempt_answers
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own quiz attempts"
ON public.quiz_attempts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read their own quiz answers"
ON public.quiz_attempt_answers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_attempts AS attempt
    WHERE attempt.id = attempt_id
      AND attempt.user_id = (SELECT auth.uid())
  )
);
