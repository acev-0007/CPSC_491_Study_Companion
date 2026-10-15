import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createClient,
} from "@supabase/supabase-js";


const {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_TEST_USER1_EMAIL,
  SUPABASE_TEST_USER1_PASSWORD,
  SUPABASE_TEST_USER2_EMAIL,
  SUPABASE_TEST_USER2_PASSWORD,
} = process.env;


const hasIntegrationEnvironment =
  Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_TEST_USER1_EMAIL &&
    SUPABASE_TEST_USER1_PASSWORD &&
    SUPABASE_TEST_USER2_EMAIL &&
    SUPABASE_TEST_USER2_PASSWORD
  );


const describeIntegration =
  hasIntegrationEnvironment
    ? describe
    : describe.skip;


function createTestClient() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


describeIntegration(
  "Supabase document integration and RLS",

  () => {
    let user1Client;
    let user2Client;

    let user1;
    let user2;

    let documentId;
    let chunkId;


    beforeAll(
      async () => {
        user1Client =
          createTestClient();

        user2Client =
          createTestClient();


        const {
          data:
            user1Auth,
          error:
            user1Error,
        } =
          await user1Client
            .auth
            .signInWithPassword({
              email:
                SUPABASE_TEST_USER1_EMAIL,

              password:
                SUPABASE_TEST_USER1_PASSWORD,
            });


        expect(
          user1Error
        ).toBeNull();


        expect(
          user1Auth.user
        ).toBeTruthy();


        user1 =
          user1Auth.user;


        const {
          data:
            user2Auth,
          error:
            user2Error,
        } =
          await user2Client
            .auth
            .signInWithPassword({
              email:
                SUPABASE_TEST_USER2_EMAIL,

              password:
                SUPABASE_TEST_USER2_PASSWORD,
            });


        expect(
          user2Error
        ).toBeNull();


        expect(
          user2Auth.user
        ).toBeTruthy();


        user2 =
          user2Auth.user;


        expect(
          user1.id
        ).not.toBe(
          user2.id
        );
      }
    );


    beforeEach(
      async () => {
        documentId = null;
        chunkId = null;


        const {
          data:
            document,
          error:
            documentError,
        } =
          await user1Client
            .from(
              "documents"
            )
            .insert({
              user_id:
                user1.id,

              name:
                `integration-${Date.now()}.txt`,

              type:
                "txt",

              mime_type:
                "text/plain",

              size:
                128,

              category:
                "Integration Test",

              course:
                "CPSC 491",

              status:
                "ready",

              extraction_error:
                null,

              text_length:
                32,

              extracted_text:
                "Supabase integration test content.",

              stored_filename:
                null,
            })
            .select()
            .single();


        expect(
          documentError
        ).toBeNull();


        expect(
          document
        ).toBeTruthy();


        documentId =
          document.id;


        const {
          data:
            chunk,
          error:
            chunkError,
        } =
          await user1Client
            .from(
              "document_chunks"
            )
            .insert({
              document_id:
                documentId,

              chunk_index:
                0,

              content:
                "Supabase integration test content.",

              start_offset:
                0,

              end_offset:
                34,
            })
            .select()
            .single();


        expect(
          chunkError
        ).toBeNull();


        expect(
          chunk
        ).toBeTruthy();


        chunkId =
          chunk.id;
      }
    );


    afterEach(
      async () => {
        if (
          documentId
        ) {
          await user1Client
            .from(
              "documents"
            )
            .delete()
            .eq(
              "id",
              documentId
            );
        }


        documentId =
          null;

        chunkId =
          null;
      }
    );


    it(
      "allows an authenticated user to access their own document and chunks",

      async () => {
        const {
          data:
            documents,
          error:
            documentError,
        } =
          await user1Client
            .from(
              "documents"
            )
            .select("*")
            .eq(
              "id",
              documentId
            );


        expect(
          documentError
        ).toBeNull();


        expect(
          documents
        ).toHaveLength(
          1
        );


        expect(
          documents[0]
            .user_id
        ).toBe(
          user1.id
        );


        const {
          data:
            chunks,
          error:
            chunkError,
        } =
          await user1Client
            .from(
              "document_chunks"
            )
            .select("*")
            .eq(
              "document_id",
              documentId
            );


        expect(
          chunkError
        ).toBeNull();


        expect(
          chunks
        ).toHaveLength(
          1
        );


        expect(
          chunks[0]
            .id
        ).toBe(
          chunkId
        );
      }
    );


    it(
      "prevents another authenticated user from reading updating or deleting the document",

      async () => {
        const {
          data:
            readResult,
          error:
            readError,
        } =
          await user2Client
            .from(
              "documents"
            )
            .select("*")
            .eq(
              "id",
              documentId
            );


        expect(
          readError
        ).toBeNull();


        expect(
          readResult
        ).toEqual([]);


        const {
          data:
            updateResult,
          error:
            updateError,
        } =
          await user2Client
            .from(
              "documents"
            )
            .update({
              name:
                "unauthorized-update.txt",
            })
            .eq(
              "id",
              documentId
            )
            .select();


        expect(
          updateError
        ).toBeNull();


        expect(
          updateResult
        ).toEqual([]);


        const {
          data:
            deleteResult,
          error:
            deleteError,
        } =
          await user2Client
            .from(
              "documents"
            )
            .delete()
            .eq(
              "id",
              documentId
            )
            .select();


        expect(
          deleteError
        ).toBeNull();


        expect(
          deleteResult
        ).toEqual([]);


        const {
          data:
            ownerResult,
          error:
            ownerError,
        } =
          await user1Client
            .from(
              "documents"
            )
            .select("*")
            .eq(
              "id",
              documentId
            );


        expect(
          ownerError
        ).toBeNull();


        expect(
          ownerResult
        ).toHaveLength(
          1
        );
      }
    );


    it(
      "prevents another user from accessing or creating chunks for a document they do not own",

      async () => {
        const {
          data:
            chunks,
          error:
            readError,
        } =
          await user2Client
            .from(
              "document_chunks"
            )
            .select("*")
            .eq(
              "document_id",
              documentId
            );


        expect(
          readError
        ).toBeNull();


        expect(
          chunks
        ).toEqual([]);


        const {
          error:
            insertError,
        } =
          await user2Client
            .from(
              "document_chunks"
            )
            .insert({
              document_id:
                documentId,

              chunk_index:
                99,

              content:
                "Unauthorized chunk",

              start_offset:
                0,

              end_offset:
                18,
            });


        expect(
          insertError
        ).toBeTruthy();
      }
    );


    it(
      "cascades chunk deletion when the owning document is deleted",

      async () => {
        const savedChunkId =
          chunkId;


        const {
          error:
            deleteError,
        } =
          await user1Client
            .from(
              "documents"
            )
            .delete()
            .eq(
              "id",
              documentId
            );


        expect(
          deleteError
        ).toBeNull();


        const {
          data:
            chunkResult,
          error:
            chunkError,
        } =
          await user1Client
            .from(
              "document_chunks"
            )
            .select("*")
            .eq(
              "id",
              savedChunkId
            );


        expect(
          chunkError
        ).toBeNull();


        expect(
          chunkResult
        ).toEqual([]);


        documentId =
          null;
      }
    );
  }
);