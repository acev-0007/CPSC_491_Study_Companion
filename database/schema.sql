-- =========================================================
-- AI STUDY COMPANION DATABASE
-- Supabase / PostgreSQL
-- =========================================================


-- =========================================================
-- CUSTOM TYPES
-- =========================================================

DO $$
BEGIN
    CREATE TYPE public.priority_level
        AS ENUM ('High', 'Medium', 'Low');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;


DO $$
BEGIN
    CREATE TYPE public.assignment_status
        AS ENUM (
            'Upcoming',
            'In Progress',
            'Completed',
            'Overdue'
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;


-- =========================================================
-- USER PROFILES
-- =========================================================
-- Supabase Auth stores email/password information in
-- auth.users.
--
-- This table stores additional information for our app.
-- id matches the user's Supabase Auth UUID.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    display_name TEXT,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- ASSIGNMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    course VARCHAR(255) NOT NULL,

    duedate TIMESTAMPTZ NOT NULL,

    estimated_time INTERVAL NOT NULL,

    priority public.priority_level
        NOT NULL DEFAULT 'Low',

    status public.assignment_status
        NOT NULL DEFAULT 'Upcoming',

    notes TEXT,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS index_assignments_user_duedate
ON public.assignments(user_id, duedate ASC);


-- =========================================================
-- AUTOMATIC UPDATED_AT
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS profiles_set_updated_at
ON public.profiles;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS assignments_set_updated_at
ON public.assignments;

CREATE TRIGGER assignments_set_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- =========================================================
-- AUTOMATIC PROFILE CREATION
-- =========================================================
-- Whenever Supabase Auth creates a user, automatically
-- create that user's profile.
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name
    )
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'display_name'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
-- Prevent users from seeing/changing another user's data.
-- =========================================================

ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assignments
ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- PROFILE SECURITY
-- =========================================================

DROP POLICY IF EXISTS "Users can view own profile"
ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
);


DROP POLICY IF EXISTS "Users can update own profile"
ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    auth.uid() = id
)
WITH CHECK (
    auth.uid() = id
);


-- =========================================================
-- ASSIGNMENT SECURITY
-- =========================================================

DROP POLICY IF EXISTS "Users can manage own assignments"
ON public.assignments;

CREATE POLICY "Users can manage own assignments"
ON public.assignments
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- =========================================================
-- PERMISSIONS
-- =========================================================

GRANT SELECT, UPDATE
ON public.profiles
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.assignments
TO authenticated;
