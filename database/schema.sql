-- Will use PostgreSQL
-- Blueprint/Database Rules

-- Custom enum to prevent typos/invalid data
CREATE TYPE priority_level AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE assignment_status AS ENUM ('Upcoming', 'In Progress', 'Completed', 'Overdue');

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Generates unique ID for every assignment created
    user_id VARCHAR(255) NOT NULL, -- User ownership reference from auth service
    title VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL,
    duedate TIMESTAMPTZ NOT NULL,
    estimated_time NUMERIC NOT NULL,
    priority priority_level NOT NULL DEFAULT 'Low',
    status assignment_status NOT NULL DEFAULT 'Upcoming',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Creates organized, fast lookup directory
CREATE INDEX index_assignments_user_duedate ON assignments(user_id, duedate ASC);

-- =========================================================
-- FLASHCARD / TOPIC SCHEMA
-- Sprint 2 - FLASH-4 / FLASH-5
-- =========================================================

CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    topic_id UUID NOT NULL
        REFERENCES topics(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL,

    front TEXT NOT NULL,
    back TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE topics
ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcards
ENABLE ROW LEVEL SECURITY;


-- Authenticated users may only access Topics they own.
CREATE POLICY "Users can manage own topics"
ON topics
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- Authenticated users may only access Flashcards they own.
CREATE POLICY "Users can manage own flashcards"
ON flashcards
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);