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
-- DOCUMENT HUB SCHEMA
-- Sprint 3 - Supabase persistence / AI readiness
-- =========================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Supabase Auth user ownership
    user_id VARCHAR(255) NOT NULL,

    -- Document metadata
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    mime_type VARCHAR(255),
    size BIGINT NOT NULL,

    category VARCHAR(100) NOT NULL DEFAULT 'Other',
    course VARCHAR(255) NOT NULL DEFAULT 'Unassigned',

    -- Processing state
    status VARCHAR(30) NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'ready', 'failed')),

    extraction_error TEXT,

    -- Extracted/normalized document content
    text_length INTEGER NOT NULL DEFAULT 0,
    extracted_text TEXT NOT NULL DEFAULT '',

    -- Temporary local-file reference.
    -- Can later be replaced by a Supabase Storage path.
    stored_filename VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DOCUMENT CHUNKS
-- =========================================================

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,

    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(document_id, chunk_index)
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX index_documents_user
ON documents(user_id);

CREATE INDEX index_documents_user_created
ON documents(user_id, created_at DESC);

CREATE INDEX index_document_chunks_document
ON document_chunks(document_id, chunk_index);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE documents
ENABLE ROW LEVEL SECURITY;

ALTER TABLE document_chunks
ENABLE ROW LEVEL SECURITY;


-- Authenticated users may only access documents they own.
CREATE POLICY "Users can manage own documents"
ON documents
FOR ALL
TO authenticated
USING (
    auth.uid()::text = user_id
)
WITH CHECK (
    auth.uid()::text = user_id
);


-- Authenticated users may only access chunks belonging
-- to documents they own.
CREATE POLICY "Users can manage chunks for own documents"
ON document_chunks
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_chunks.document_id
          AND documents.user_id = auth.uid()::text
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_chunks.document_id
          AND documents.user_id = auth.uid()::text
    )
);