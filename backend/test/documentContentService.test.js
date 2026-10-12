import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DocumentContentService,
} from "../src/documentContentService.js";


const mockDocuments = [
  {
    id: "doc-1",
    user_id: "student-1",
    name: "notes.txt",
    type: "txt",
    mime_type: "text/plain",
    size: 100,
    category: "Lecture Notes",
    course: "CPSC 491",
    status: "ready",
    extraction_error: null,
    text_length: 24,
    extracted_text:
      "Operating systems notes.",
    stored_filename:
      "doc-1.txt",
    created_at:
      "2026-10-11T12:00:00.000Z",
  },

  {
    id: "doc-2",
    user_id: "student-1",
    name: "broken.pdf",
    type: "pdf",
    mime_type:
      "application/pdf",
    size: 200,
    category: "Other",
    course: "Unassigned",
    status: "failed",
    extraction_error:
      "Text extraction failed.",
    text_length: 0,
    extracted_text: "",
    stored_filename:
      "doc-2.pdf",
    created_at:
      "2026-10-11T12:05:00.000Z",
  },

  {
    id: "doc-3",
    user_id: "student-2",
    name: "private.txt",
    type: "txt",
    mime_type: "text/plain",
    size: 120,
    category: "Study Guide",
    course: "CPSC 491",
    status: "ready",
    extraction_error: null,
    text_length: 20,
    extracted_text:
      "Private student notes.",
    stored_filename:
      "doc-3.txt",
    created_at:
      "2026-10-11T12:10:00.000Z",
  },
];


const mockChunks = [
  {
    id: "chunk-1",
    document_id: "doc-1",
    chunk_index: 0,
    content:
      "Operating systems",
    start_offset: 0,
    end_offset: 17,
  },

  {
    id: "chunk-2",
    document_id: "doc-1",
    chunk_index: 1,
    content:
      "systems notes.",
    start_offset: 10,
    end_offset: 24,
  },
];


function matchesFilters(
  row,
  filters
) {
  return filters.every(
    ({ column, value }) =>
      row[column] === value
  );
}


function createFakeQuery(
  rows
) {
  const filters = [];
  let orderBy = null;

  const query = {
    select() {
      return query;
    },

    eq(
      column,
      value
    ) {
      filters.push({
        column,
        value,
      });

      return query;
    },

    order(
      column,
      options = {}
    ) {
      orderBy = {
        column,

        ascending:
          options.ascending ??
          true,
      };

      let result =
        rows.filter(
          (row) =>
            matchesFilters(
              row,
              filters
            )
        );

      if (orderBy) {
        result = [
          ...result,
        ].sort(
          (a, b) => {
            const direction =
              orderBy.ascending
                ? 1
                : -1;

            return (
              a[orderBy.column] -
              b[orderBy.column]
            ) * direction;
          }
        );
      }

      return Promise.resolve({
        data: result,
        error: null,
      });
    },

    maybeSingle() {
      const result =
        rows.find(
          (row) =>
            matchesFilters(
              row,
              filters
            )
        );

      return Promise.resolve({
        data:
          result ?? null,

        error: null,
      });
    },
  };

  return query;
}


vi.mock(
  "../src/config/supabase.js",
  () => ({
    createUserSupabaseClient:
      vi.fn(() => ({
        from:
          vi.fn(
            (table) => {
              if (
                table ===
                "documents"
              ) {
                return createFakeQuery(
                  mockDocuments
                );
              }

              if (
                table ===
                "document_chunks"
              ) {
                return createFakeQuery(
                  mockChunks
                );
              }

              throw new Error(
                `Unexpected table: ${table}`
              );
            }
          ),
      })),
  })
);


describe(
  "DocumentContentService",
  () => {
    let service;


    beforeEach(() => {
      service =
        new DocumentContentService(
          "student-1-token"
        );
    });


    it(
      "returns extracted content for an owned document",
      async () => {
        const result =
          await service
            .getDocumentContent(
              "doc-1",
              "student-1"
            );

        expect(result).toEqual({
          documentId:
            "doc-1",

          name:
            "notes.txt",

          status:
            "ready",

          text:
            "Operating systems notes.",

          textLength:
            24,
        });
      }
    );


    it(
      "returns null for another user's document",
      async () => {
        const result =
          await service
            .getDocumentContent(
              "doc-3",
              "student-1"
            );

        expect(
          result
        ).toBeNull();
      }
    );


    it(
      "returns ordered chunks for an owned document",
      async () => {
        const result =
          await service
            .getDocumentChunks(
              "doc-1",
              "student-1"
            );

        expect(
          result.documentId
        ).toBe("doc-1");

        expect(
          result.chunks
        ).toHaveLength(2);

        expect(
          result.chunks[0]
            .chunkIndex
        ).toBe(0);

        expect(
          result.chunks[1]
            .chunkIndex
        ).toBe(1);
      }
    );


    it(
      "returns AI-ready text and chunks for a ready document",
      async () => {
        const result =
          await service
            .getAiReadyContent(
              "doc-1",
              "student-1"
            );

        expect(
          result.status
        ).toBe("ready");

        expect(
          result.text
        ).toContain(
          "Operating systems"
        );

        expect(
          result.chunks
        ).toHaveLength(2);
      }
    );


    it(
      "does not return AI-ready content for a failed document",
      async () => {
        const result =
          await service
            .getAiReadyContent(
              "doc-2",
              "student-1"
            );

        expect(result).toEqual({
          documentId:
            "doc-2",

          name:
            "broken.pdf",

          status:
            "failed",

          text:
            null,

          chunks: [],
        });
      }
    );
  }
);