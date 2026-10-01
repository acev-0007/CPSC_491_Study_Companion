# FLASH-4 — Flashcard and Topic Data Model Decision

**Developer:** Anthony Acevedo  
**Ticket:** FLASH-4 — Define Flashcard and Topic Data Models  
**Sprint:** Sprint 2

## Purpose

Sprint 2 replaces the Flashcard Viewer's hardcoded data with persistent application data. This document defines the initial Topic and Flashcard structures, their relationship, and how ownership will be enforced using the authentication and Supabase patterns already established by the team.

The design is intentionally limited to the persistence requirements needed for Sprint 2 while leaving a clear path for AI-generated Flashcards in Sprint 3.

## Relationship

```text
User
 |
 +-- Topic
      |
      +-- Flashcard
      +-- Flashcard
      +-- Flashcard
```

A `Topic` represents a collection of Flashcards associated with a piece of study material or subject. A Topic belongs to one authenticated user. A Topic can contain multiple Flashcards, while each Flashcard belongs to exactly one Topic through `topic_id`.

This structure also provides a natural location for source material that can later be processed by the AI Flashcard generation workflow planned for Sprint 3.

## Schema

```sql
topics
------------------
id            UUID PRIMARY KEY
user_id       VARCHAR(255) NOT NULL
title         VARCHAR(255) NOT NULL
source_text   TEXT
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ

flashcards
------------------
id            UUID PRIMARY KEY
topic_id      UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE
user_id       VARCHAR(255) NOT NULL
front         TEXT NOT NULL
back          TEXT NOT NULL
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

> **Implementation check:** Before creating the actual Supabase tables/migration, verify the type used by the existing `assignments.user_id` column. If the project stores Supabase Auth user IDs as `UUID`, use `UUID` here instead of `VARCHAR(255)` so the new schema follows the repository's existing convention.

### Topic

- `id` uniquely identifies the Topic.
- `user_id` identifies the authenticated user who owns the Topic.
- `title` provides a user-readable name for the Topic.
- `source_text` optionally stores the study material associated with the Topic.
- `created_at` and `updated_at` support persistence and future auditing.

### Flashcard

- `id` uniquely identifies the Flashcard.
- `topic_id` associates the Flashcard with exactly one Topic.
- `user_id` identifies the authenticated user who owns the Flashcard.
- `front` contains the question, term, or prompt.
- `back` contains the corresponding answer or explanation.
- `created_at` and `updated_at` support persistence and future auditing.

`ON DELETE CASCADE` is used so deleting a Topic also removes Flashcards that depend on that Topic rather than leaving orphaned records.

## Decision: User Ownership

Two ownership approaches were considered.

### Option A — `user_id` on both tables (Chosen)

Each Topic and Flashcard carries its own `user_id`.

This allows routes to directly scope queries using:

```js
.eq("user_id", req.user.id)
```

### Option B — `user_id` only on Topics

Flashcard ownership could instead be derived through its associated Topic. This avoids duplicating ownership information but requires Topic-based joins or additional lookups when authorizing Flashcard operations.

### Why Option A Was Selected

Option A follows the conventions already established by the existing Supabase-backed resources in the project.

The current Assignment implementation scopes records directly using a `user_id` column and the authenticated user's ID. Following the same approach for Flashcards keeps authorization logic consistent across the backend rather than introducing a different ownership strategy for one resource.

The intended request pattern is:

```text
Authenticated User
        |
        v
requireAuth
        |
        v
req.user.id
        |
        v
User-scoped Supabase query
        |
        v
Topic / Flashcard owned by that user
```

The duplicated `user_id` does introduce the possibility that a Flashcard could theoretically reference a Topic owned by a different user. For that reason, Flashcard creation must not rely on the foreign key alone.

The API must verify that the referenced Topic belongs to the authenticated user before creating the Flashcard. Supabase RLS/user-scoped access should also be used where supported by the project's existing database configuration.

## Decision: Topic and Flashcard Validation

The foreign key:

```text
flashcards.topic_id -> topics.id
```

guarantees that the referenced Topic exists. It does **not** by itself guarantee that the authenticated user owns that Topic.

Therefore, Flashcard creation will follow this logic:

```text
Authenticated request
        |
        v
Receive topic_id
        |
        v
Verify Topic belongs to req.user.id
        |
        +---- No ----> Reject request
        |
       Yes
        |
        v
Create Flashcard using authenticated user's ID
```

The client will not be trusted to determine Flashcard ownership. `user_id` should be derived from the authenticated request rather than accepted as authoritative input from the request body.

This prevents a client from creating a Flashcard while claiming another user's ID.

## Decision: Topic Creation During Sprint 2

FLASH-5 focuses on implementing the Flashcard API rather than a complete Topic-management feature.

For Sprint 2, the Flashcard API will require an existing valid `topic_id`. Topics needed for persistence testing may be created as controlled test or seed data while the Flashcard persistence workflow is established.

A user-facing Topic creation workflow is intentionally deferred because Sprint 3 introduces AI-generated Flashcards and study-material processing, which will provide a clearer application workflow for creating Topics.

If implementation of FLASH-5 shows that a minimal Topic creation endpoint is necessary to demonstrate the Sprint 2 persistent Flashcard workflow, a small authenticated `POST /api/topics` endpoint may be added without expanding into full Topic CRUD.

This keeps Sprint 2 focused on:

```text
Stored Topic
     |
     v
Flashcard API
     |
     v
Persistent Flashcards
     |
     v
Flashcard Viewer
```

rather than introducing unnecessary Topic-management functionality.

## API Implications for FLASH-5

This model is intended to support the next Sprint 2 task.

Potential Flashcard operations include:

- `POST /api/flashcards`
- `GET /api/flashcards`
- `GET /api/flashcards/:id`

All operations must be scoped to the authenticated user.

### Creation Flow

1. `requireAuth` establishes the authenticated user.
2. The backend receives the requested `topic_id`, `front`, and `back`.
3. The backend verifies that the Topic belongs to the authenticated user.
4. The backend derives `user_id` from `req.user.id`.
5. The Flashcard is inserted.
6. Invalid input or unauthorized Topic access is rejected.

### Retrieval Flow

Flashcards are filtered by the authenticated user's `user_id`, preventing one user from retrieving another user's cards.

## Sprint 3 Compatibility

This model intentionally prepares for the planned AI Flashcard workflow:

```text
Study Material
      |
      v
Topic / Source Text
      |
      v
AI Service
      |
      v
Generated Flashcards
      |
      v
Validate
      |
      v
Persist
      |
      v
Flashcard Viewer
```

Sprint 3 can therefore add AI generation without replacing the persistence model established during Sprint 2.

## Final Decision

Sprint 2 will use a one-to-many Topic-to-Flashcard relationship with direct user ownership stored on both resources.

The design prioritizes:

- consistency with the project's existing Supabase patterns;
- straightforward authenticated queries;
- explicit user ownership;
- simple Flashcard retrieval;
- database referential integrity; and
- compatibility with Sprint 3 AI generation.

The schema will remain intentionally small until later requirements justify additional fields or relationships.
