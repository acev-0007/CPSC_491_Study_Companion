
-- SCRUM-128: Trusted server-side quiz grading.
-- Run AFTER 20261119_quiz_trusted_identity.sql.
--
-- Security:
-- - User identity comes from auth.uid().
-- - Answer keys come from protected generated_quizzes.
-- - Attempts and answers are saved atomically.
-- - Idempotency keys prevent duplicate submissions.
-- - Only authenticated users may execute this RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_quiz_id UUID,
  p_idempotency_key UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quiz public.generated_quizzes%ROWTYPE;
  v_attempt public.quiz_attempts%ROWTYPE;
  v_attempt_id UUID;
  v_total INTEGER;
  v_correct INTEGER := 0;
  v_item JSONB;
  v_answer JSONB;
  v_index_text TEXT;
  v_selected TEXT;
  v_correct_option TEXT;
  v_is_correct BOOLEAN;
  v_seen_indices INTEGER[] := '{}';
  v_conflict_constraint TEXT;
  i INTEGER;
BEGIN
  -- Authentication is mandatory.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- Required identifiers.
  IF p_quiz_id IS NULL
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid_request'
      USING ERRCODE = '22023';
  END IF;

  -- Existing submission: return the original result.
  SELECT *
  INTO v_attempt
  FROM public.quiz_attempts
  WHERE user_id = v_user_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_attempt.quiz_id IS DISTINCT FROM p_quiz_id THEN
      RAISE EXCEPTION 'retry_conflict'
        USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object(
      'attemptId', v_attempt.id,
      'duplicate', TRUE,
      'quizId', v_attempt.quiz_id,
      'topic', v_attempt.topic,
      'scorePercent', v_attempt.score_percent,
      'correctCount', v_attempt.correct_count,
      'totalQuestions', v_attempt.total_questions,
      'completedAt', v_attempt.completed_at
    );
  END IF;

  -- Only load a quiz owned by the authenticated student.
  SELECT *
  INTO v_quiz
  FROM public.generated_quizzes
  WHERE id = p_quiz_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  v_total := jsonb_array_length(v_quiz.questions);

  -- Require one answer per question.
  IF p_answers IS NULL
     OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) <> v_total THEN
    RAISE EXCEPTION 'invalid_answers'
      USING ERRCODE = '22023';
  END IF;

  -- Validate indices and selections before writing.
  FOR v_answer IN
    SELECT value
    FROM jsonb_array_elements(p_answers)
  LOOP
    IF jsonb_typeof(v_answer) <> 'object' THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;

    v_index_text := v_answer ->> 'questionIndex';

    IF jsonb_typeof(v_answer -> 'questionIndex')
         IS DISTINCT FROM 'number'
       OR v_index_text IS NULL
       OR v_index_text !~ '^(0|[1-9][0-9]*)$'
       OR length(v_index_text) > 10 THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;

    -- Numeric comparison before integer conversion.
    IF v_index_text::NUMERIC >= v_total THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;

    i := v_index_text::INTEGER;

    IF i = ANY(v_seen_indices) THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;

    v_seen_indices := array_append(v_seen_indices, i);

    v_selected := v_answer ->> 'selectedOptionId';

    IF jsonb_typeof(v_answer -> 'selectedOptionId')
         IS DISTINCT FROM 'string'
       OR v_selected IS NULL
       OR v_selected NOT IN ('A', 'B', 'C', 'D') THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- All indices must be present exactly once.
  IF array_length(v_seen_indices, 1) IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'invalid_answers'
      USING ERRCODE = '22023';
  END IF;

  -- Insert the attempt header.
  -- A concurrent retry may encounter the unique index.
  BEGIN
    INSERT INTO public.quiz_attempts (
      user_id,
      quiz_id,
      idempotency_key,
      topic,
      score_percent,
      correct_count,
      total_questions
    )
    VALUES (
      v_user_id,
      v_quiz.id,
      p_idempotency_key,
      v_quiz.topic,
      0,
      0,
      v_total
    )
    RETURNING id INTO v_attempt_id;

  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS
      v_conflict_constraint = CONSTRAINT_NAME;

    IF v_conflict_constraint
         <> 'quiz_attempts_idempotency_idx' THEN
      RAISE;
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = v_user_id
      AND idempotency_key = p_idempotency_key;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'retry_conflict'
        USING ERRCODE = '40001';
    END IF;

    IF v_attempt.quiz_id IS DISTINCT FROM p_quiz_id THEN
      RAISE EXCEPTION 'retry_conflict'
        USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object(
      'attemptId', v_attempt.id,
      'duplicate', TRUE,
      'quizId', v_attempt.quiz_id,
      'topic', v_attempt.topic,
      'scorePercent', v_attempt.score_percent,
      'correctCount', v_attempt.correct_count,
      'totalQuestions', v_attempt.total_questions,
      'completedAt', v_attempt.completed_at
    );
  END;

  -- Grade from the trusted database snapshot.
  FOR i IN 0 .. v_total - 1 LOOP
    v_item := v_quiz.questions -> i;

    SELECT value ->> 'selectedOptionId'
    INTO v_selected
    FROM jsonb_array_elements(p_answers)
    WHERE (value ->> 'questionIndex')::INTEGER = i;

    IF v_selected IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_item -> 'options') AS o
         WHERE o ->> 'id' = v_selected
       ) THEN
      RAISE EXCEPTION 'invalid_answers'
        USING ERRCODE = '22023';
    END IF;

    v_correct_option := v_item ->> 'correctOptionId';

    v_is_correct := v_selected = v_correct_option;

    IF v_is_correct THEN
      v_correct := v_correct + 1;
    END IF;

    INSERT INTO public.quiz_attempt_answers (
      attempt_id,
      question_index,
      question_text,
      selected_option_id,
      correct_option_id,
      options,
      category,
      is_correct
    )
    VALUES (
      v_attempt_id,
      i,
      v_item ->> 'question',
      v_selected,
      v_correct_option,
      v_item -> 'options',
      COALESCE(
        NULLIF(btrim(v_item ->> 'category'), ''),
        'General'
      ),
      v_is_correct
    );
  END LOOP;

  -- Finalize the score.
  UPDATE public.quiz_attempts
  SET correct_count = v_correct,
      score_percent =
        round(100.0 * v_correct / v_total)::INTEGER
  WHERE id = v_attempt_id
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'attemptId', v_attempt.id,
    'duplicate', FALSE,
    'quizId', v_attempt.quiz_id,
    'topic', v_attempt.topic,
    'scorePercent', v_attempt.score_percent,
    'correctCount', v_attempt.correct_count,
    'totalQuestions', v_attempt.total_questions,
    'completedAt', v_attempt.completed_at
  );
END;
$$;

-- Restrict execution privileges.
REVOKE ALL ON FUNCTION
  public.submit_quiz_attempt(UUID, UUID, JSONB)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.submit_quiz_attempt(UUID, UUID, JSONB)
TO authenticated;

COMMIT;
