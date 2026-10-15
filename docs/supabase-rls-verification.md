## Supabase RLS Integration Manual Verification

Date: 2026-10-14

Automated by:
`backend/test/supabaseDocuments.integration.test.js`

The test uses two authenticated Supabase users and the publishable key to verify database-level RLS behavior against the live Supabase project.

Environment:
- Supabase project used for team development
- Two dedicated test users:
  - Test User 1
  - Test User 2
- Tests performed using authenticated Supabase clients with the publishable key

### Test 1 - Owner can access own document

Steps:
1. Sign in as Test User 1.
2. Insert a document with `user_id` equal to Test User 1's auth ID.
3. Query the inserted document.

Expected:
Test User 1 can read the document.

Actual:
Document returned successfully.

Result:
PASS

### Test 2 - Another user cannot read the document

Steps:
1. Keep the document owned by Test User 1.
2. Sign in as Test User 2.
3. Query the same document ID.

Expected:
No document should be visible to Test User 2.

Actual:
Query returned zero rows.

Result:
PASS

### Test 3 - Another user cannot update the document

Steps:
1. Sign in as Test User 2.
2. Attempt to update the Test User 1 document.

Expected:
The update should not affect the document.

Actual:
No rows were updated. The original document remained unchanged.

Result:
PASS

### Test 4 - Another user cannot delete the document

Steps:
1. Sign in as Test User 2.
2. Attempt to delete the Test User 1 document.

Expected:
The document should remain.

Actual:
No rows were deleted. Test User 1 could still retrieve the document.

Result:
PASS

### Test 5 - Chunk ownership is enforced

Steps:
1. Test User 1 creates a document and document chunk.
2. Test User 2 attempts to read the chunk.
3. Test User 2 attempts to create a chunk for Test User 1's document.

Expected:
Test User 2 cannot read or create chunks for the document.

Actual:
Chunk read returned no rows and unauthorized chunk creation was rejected.

Result:
PASS

### Test 6 - Cascade deletion

Steps:
1. Test User 1 creates a document with an associated chunk.
2. Delete the document as Test User 1.
3. Query the chunk ID.

Expected:
The chunk should be deleted automatically through `ON DELETE CASCADE`.

Actual:
No chunk remained after document deletion.

Result:
PASS