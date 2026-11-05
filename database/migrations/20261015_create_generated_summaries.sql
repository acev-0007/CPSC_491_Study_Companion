
-- =========================================================
-- SCRUM-231: AI SUMMARY PERSISTENCE
-- =========================================================
-- Stores generated summaries for authenticated users.
-- Supports future Past Activities integration (SCRUM-232).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.generated_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    source_text TEXT NOT NULL,
    summary_text TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT generated_summaries_source_not_empty
        CHECK (length(trim(source_text)) > 0),

    CONSTRAINT generated_summaries_summary_not_empty
        CHECK (length(trim(summary_text)) > 0)
);

-- Efficient retrieval of summaries by user and date.
CREATE INDEX IF NOT EXISTS
    generated_summaries_user_created_idx
ON public.generated_summaries (
    user_id,
    created_at DESC
);

-- Enable Row Level Security.
ALTER TABLE public.generated_summaries
ENABLE ROW LEVEL SECURITY;

-- Users may read only their own summaries.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'generated_summaries'
          AND policyname = 'Users can read own summaries'
    ) THEN
        CREATE POLICY "Users can read own summaries"
        ON public.generated_summaries
        FOR SELECT
        TO authenticated
        USING ((SELECT auth.uid()) = user_id);
    END IF;
END
$$;

-- Users may insert summaries only for themselves.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'generated_summaries'
          AND policyname = 'Users can insert own summaries'
    ) THEN
        CREATE POLICY "Users can insert own summaries"
        ON public.generated_summaries
        FOR INSERT
        TO authenticated
        WITH CHECK ((SELECT auth.uid()) = user_id);
    END IF;
END
$$;
