-- Will use PostgreSQL
-- Blueprint/Database Rules

-- Custom enum (prevent typos/invalid data)
CREATE TYPE priority_level AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE assignment_status AS ENUM ('Upcoming', 'In Progress', 'Completed', 'Overdue');

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Generates unique ID for every assignment created
    user_id VARCHAR(255) NOT NULL, -- User ownership reference from auth service
    title VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL,
    duedate TIMESTAMPTZ NOT NULL,
    priority priority_level NOT NULL DEFAULT 'Low',
    status assignment_status NOT NULL DEFAULT 'Upcoming',
    notes TEXT,
    estimated_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Creates organized, fast lookup directory
CREATE INDEX index_assignments_user_duedate ON assignments(user_id, duedate ASC)