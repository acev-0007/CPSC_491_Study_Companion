import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import request from "supertest";

import {
  access,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  PDFDocument,
  StandardFonts,
} from "pdf-lib";

import { createApp } from "../src/app.js";

import {
  ACCESS_COOKIE,
} from "../src/auth/sessionCookies.js";


const mockDocuments = [];
const mockDocumentChunks = [];
const mockDocumentOperations = [];

let failNextDocumentInsert = false;
let failNextChunkInsert = false;


function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function createFakeQuery(
  tableRows,
  tableName
) {
  let operation = "select";
  let payload = null;
  let orderBy = null;

  const filters = [];


  function matches(row) {
    return filters.every(
      ({ column, value }) =>
        row[column] === value
    );
  }


  function executeSingle() {
    if (operation === "insert") {
      if (
        tableName === "documents" &&
        failNextDocumentInsert
      ) {
        failNextDocumentInsert = false;

        return {
          data: null,

          error:
            new Error(
              "Simulated document insert failure"
            ),
        };
      }


      const row = clone(payload);

      tableRows.push(row);


      if (
        tableName ===
        "documents"
      ) {
        mockDocumentOperations.push({
          operation:
            "insert",

          data:
            clone(row),
        });
      }


      return {
        data:
          clone(row),

        error:
          null,
      };
    }


    return {
      data:
        null,

      error:
        new Error(
          `Unsupported fake Supabase single operation: ${operation}`
        ),
    };
  }


  function executeMaybeSingle() {
    if (operation === "select") {
      const row =
        tableRows.find(
          matches
        );

      return {
        data:
          row
            ? clone(row)
            : null,

        error:
          null,
      };
    }

    if (operation === "update") {
      const index =
        tableRows.findIndex(
          matches
        );


      if (index === -1) {
        return {
          data:
            null,

          error:
            null,
        };
      }


      tableRows[index] = {
        ...tableRows[index],
        ...clone(payload),
      };


      if (
        tableName ===
        "documents"
      ) {
        mockDocumentOperations.push({
          operation:
            "update",

          data:
            clone(payload),
        });
      }


      return {
        data:
          clone(
            tableRows[index]
          ),

        error:
          null,
      };
    }


    if (operation === "delete") {
      const index =
        tableRows.findIndex(
          matches
        );


      if (index === -1) {
        return {
          data:
            null,

          error:
            null,
        };
      }


      const [
        deletedRow,
      ] = tableRows.splice(
        index,
        1
      );


      return {
        data:
          clone(
            deletedRow
          ),

        error:
          null,
      };
    }


    return {
      data:
        null,

      error:
        new Error(
          `Unsupported fake Supabase maybeSingle operation: ${operation}`
        ),
    };
  }


  function executeMany() {
    if (operation === "insert") {
      if (
        tableName ===
          "document_chunks" &&
        failNextChunkInsert
      ) {
        failNextChunkInsert = false;

        return {
          data:
            null,

          error:
            new Error(
              "Simulated chunk insert failure"
            ),
        };
      }


      const rows =
        Array.isArray(payload)
          ? payload.map(
              clone
            )
          : [
              clone(payload),
            ];


      tableRows.push(
        ...rows
      );


      return {
        data:
          rows.map(
            clone
          ),

        error:
          null,
      };
    }


    if (operation === "delete") {
      const deletedRows =
        tableRows
          .filter(
            matches
          )
          .map(
            clone
          );


      for (
        let index =
          tableRows.length - 1;

        index >= 0;

        index -= 1
      ) {
        if (
          matches(
            tableRows[index]
          )
        ) {
          tableRows.splice(
            index,
            1
          );
        }
      }


      return {
        data:
          deletedRows,

        error:
          null,
      };
    }


    let rows =
      tableRows
        .filter(
          matches
        )
        .map(
          clone
        );


    if (orderBy) {
      rows.sort(
        (a, b) => {
          const aValue =
            a[
              orderBy.column
            ];

          const bValue =
            b[
              orderBy.column
            ];


          if (
            aValue ===
            bValue
          ) {
            return 0;
          }


          const direction =
            orderBy.ascending
              ? 1
              : -1;


          return (
            aValue >
            bValue
              ? direction
              : -direction
          );
        }
      );
    }


    return {
      data:
        rows,

      error:
        null,
    };
  }


  const query = {
    select() {
      return query;
    },


    insert(value) {
      operation =
        "insert";

      payload =
        value;

      return query;
    },


    update(value) {
      operation =
        "update";

      payload =
        value;

      return query;
    },


    delete() {
      operation =
        "delete";

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
          options
            .ascending ??
          true,
      };


      return Promise.resolve(
        executeMany()
      );
    },


    single() {
      return Promise.resolve(
        executeSingle()
      );
    },


    maybeSingle() {
      return Promise.resolve(
        executeMaybeSingle()
      );
    },


    then(
      resolve,
      reject
    ) {
      return Promise.resolve(
        executeMany()
      ).then(
        resolve,
        reject
      );
    },
  };


  return query;
}


vi.mock(
  "../src/config/supabase.js",

  () => ({
    createSupabaseClient:
      vi.fn(
        () => ({
          auth: {
            getUser:
              vi.fn(
                async (
                  accessToken
                ) => {
                  const users = {
                    "student-1-token":
                      {
                        id:
                          "student-1",
                      },

                    "student-2-token":
                      {
                        id:
                          "student-2",
                      },
                  };


                  const user =
                    users[
                      accessToken
                    ];


                  if (user) {
                    return {
                      data: {
                        user,
                      },

                      error:
                        null,
                    };
                  }


                  return {
                    data: {
                      user:
                        null,
                    },

                    error:
                      new Error(
                        "Invalid test token"
                      ),
                  };
                }
              ),


            refreshSession:
              vi.fn(),
          },
        })
      ),


    createUserSupabaseClient:
      vi.fn(
        () => ({
          from:
            vi.fn(
              (table) => {
                if (
                  table ===
                  "documents"
                ) {
                  return createFakeQuery(
                    mockDocuments,
                    "documents"
                  );
                }


                if (
                  table ===
                  "document_chunks"
                ) {
                  return createFakeQuery(
                    mockDocumentChunks,
                    "document_chunks"
                  );
                }


                throw new Error(
                  `Unexpected fake Supabase table: ${table}`
                );
              }
            ),
        })
      ),
  })
);


async function makePdf(text) {
  const pdf =
    await PDFDocument
      .create();


  const page =
    pdf.addPage(
      [612, 792]
    );


  const font =
    await pdf.embedFont(
      StandardFonts
        .Helvetica
    );


  page.drawText(
    text,
    {
      x:
        72,

      y:
        720,

      size:
        12,

      font,
    }
  );


  return Buffer.from(
    await pdf.save()
  );
}


describe(
  "document API",

  () => {
    let tempRoot;
    let app;


    beforeEach(
      async () => {
        mockDocuments.length =
          0;

        mockDocumentChunks.length =
          0;

        mockDocumentOperations.length =
          0;

        failNextDocumentInsert =
          false;

        failNextChunkInsert =
          false;


        tempRoot =
          await mkdtemp(
            path.join(
              os.tmpdir(),
              "textbook-hub-test-"
            )
          );


        app =
          createApp({
            dataDir:
              path.join(
                tempRoot,
                "data"
              ),

            uploadDir:
              path.join(
                tempRoot,
                "uploads"
              ),
          });
      }
    );


    afterEach(
      async () => {
        await rm(
          tempRoot,
          {
            recursive:
              true,

            force:
              true,
          }
        );
      }
    );


    it(
      "uploads and extracts a valid TXT file",

      async () => {
        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Operating systems manage hardware resources."
              ),

              {
                filename:
                  "os-notes.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(
          201
        );


        expect(
          response.body
            .document
            .status
        ).toBe(
          "ready"
        );


        expect(
          response.body
            .document
            .type
        ).toBe(
          "txt"
        );


        expect(
          response.body
            .document
            .textLength
        ).toBeGreaterThan(
          0
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          1
        );


        expect(
          mockDocumentChunks[
            0
          ].document_id
        ).toBe(
          response.body
            .document
            .id
        );


        expect(
          mockDocumentChunks[
            0
          ].chunk_index
        ).toBe(
          0
        );


        expect(
          mockDocumentChunks[
            0
          ].content
        ).toContain(
          "Operating systems manage hardware resources."
        );


        expect(
          mockDocumentChunks[
            0
          ].start_offset
        ).toBe(
          0
        );


        expect(
          mockDocumentChunks[
            0
          ].end_offset
        ).toBeGreaterThan(
          0
        );
      }
    );


    it(
      "rejects document access without authentication",

      async () => {
        const response =
          await request(
            app
          ).get(
            "/api/documents"
          );


        expect(
          response.status
        ).toBe(
          401
        );


        expect(
          response.body
            .error
        ).toMatch(
          /authentication required/i
        );
      }
    );


    it(
      "uploads and extracts a valid digital PDF",

      async () => {
        const pdf =
          await makePdf(
            "Virtual memory allows processes to use logical address spaces."
          );


        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",
              pdf,
              {
                filename:
                  "virtual-memory.pdf",

                contentType:
                  "application/pdf",
              }
            );


        expect(
          response.status
        ).toBe(
          201
        );


        expect(
          response.body
            .document
            .status
        ).toBe(
          "ready"
        );


        expect(
          response.body
            .document
            .type
        ).toBe(
          "pdf"
        );


        expect(
          response.body
            .document
            .textLength
        ).toBeGreaterThan(
          0
        );


        expect(
          mockDocumentChunks
            .length
        ).toBeGreaterThan(
          0
        );


        expect(
          mockDocumentChunks[
            0
          ].document_id
        ).toBe(
          response.body
            .document
            .id
        );
      }
    );


    it(
      "rejects an invalid file type",

      async () => {
        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "fake image"
              ),

              {
                filename:
                  "diagram.png",

                contentType:
                  "image/png",
              }
            );


        expect(
          response.status
        ).toBe(
          400
        );


        expect(
          response.body
            .error
        ).toMatch(
          /only txt and pdf/i
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          0
        );
      }
    );


    it(
      "keeps the document but marks it failed when extraction fails",

      async () => {
        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "this is not a valid pdf"
              ),

              {
                filename:
                  "broken.pdf",

                contentType:
                  "application/pdf",
              }
            );


        expect(
          response.status
        ).toBe(
          201
        );


        expect(
          response.body
            .document
            .status
        ).toBe(
          "failed"
        );


        expect(
          response.body
            .document
            .extractionError
        ).toBeTruthy();


        expect(
          mockDocumentChunks
        ).toHaveLength(
          0
        );
      }
    );


    it(
      "returns an uploaded item in the current user's document list",

      async () => {
        await request(
          app
        )
          .post(
            "/api/documents"
          )
          .set(
            "Cookie",
            `${ACCESS_COOKIE}=student-1-token`
          )
          .attach(
            "file",

            Buffer.from(
              "Chapter one notes"
            ),

            {
              filename:
                "chapter-1.txt",

              contentType:
                "text/plain",
            }
          );


        await request(
          app
        )
          .post(
            "/api/documents"
          )
          .set(
            "Cookie",
            `${ACCESS_COOKIE}=student-2-token`
          )
          .attach(
            "file",

            Buffer.from(
              "Other student's notes"
            ),

            {
              filename:
                "private.txt",

              contentType:
                "text/plain",
            }
          );


        const response =
          await request(
            app
          )
            .get(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
            .documents
        ).toHaveLength(
          1
        );


        expect(
          response.body
            .documents[
              0
            ].name
        ).toBe(
          "chapter-1.txt"
        );


        expect(
          response.body
            .documents[
              0
            ]
        ).not
          .toHaveProperty(
            "extractedText"
          );


        expect(
          mockDocuments
        ).toHaveLength(
          2
        );


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document
                .user_id ===
              "student-1"
          );


        expect(
          storedDocument
            .extracted_text
        ).toContain(
          "Chapter one notes"
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          2
        );
      }
    );

    it(
      "returns AI-ready content for an owned ready document",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "CPU scheduling selects the next process to execute."
              ),

              {
                filename:
                  "cpu-scheduling.txt",

                contentType:
                  "text/plain",
              }
            );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .get(
              `/api/documents/${documentId}/ai-content`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
            .documentId
        ).toBe(
          documentId
        );


        expect(
          response.body
            .status
        ).toBe(
          "ready"
        );


        expect(
          response.body
            .text
        ).toContain(
          "CPU scheduling selects the next process to execute."
        );


        expect(
          response.body
            .chunks
            .length
        ).toBeGreaterThan(
          0
        );


        expect(
          response.body
            .chunks[
              0
            ].content
        ).toContain(
          "CPU scheduling"
        );
      }
    );

    it(
      "returns 404 when AI-ready document content does not exist",

      async () => {
        const response =
          await request(
            app
          )
            .get(
              "/api/documents/00000000-0000-0000-0000-000000000001/ai-content"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          404
        );


        expect(
          response.body
            .error
        ).toMatch(
          /document not found/i
        );
      }
    );

    it(
      "does not allow AI-ready access to another user's document",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Private AI study material"
              ),

              {
                filename:
                  "private-ai-notes.txt",

                contentType:
                  "text/plain",
              }
            );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .get(
              `/api/documents/${documentId}/ai-content`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-2-token`
            );


        expect(
          response.status
        ).toBe(
          404
        );


        expect(
          response.body
            .error
        ).toMatch(
          /document not found/i
        );
      }
    );

    it(
      "rejects AI-ready access while a document is processing",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Processing state test"
              ),

              {
                filename:
                  "processing.txt",

                contentType:
                  "text/plain",
              }
            );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document.id ===
              documentId
          );


        storedDocument.status =
          "processing";


        const response =
          await request(
            app
          )
            .get(
              `/api/documents/${documentId}/ai-content`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          409
        );


        expect(
          response.body
            .status
        ).toBe(
          "processing"
        );


        expect(
          response.body
            .error
        ).toMatch(
          /still processing/i
        );
      }
    );

      it(
      "rejects AI-ready access when document processing failed",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Failed state test"
              ),

              {
                filename:
                  "failed.txt",

                contentType:
                  "text/plain",
              }
            );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document.id ===
              documentId
          );


        storedDocument.status =
          "failed";


        const response =
          await request(
            app
          )
            .get(
              `/api/documents/${documentId}/ai-content`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          422
        );


        expect(
          response.body
            .status
        ).toBe(
          "failed"
        );


        expect(
          response.body
            .error
        ).toMatch(
          /processing failed/i
        );
      }
    );

    it(
      "updates document metadata",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .field(
              "category",
              "Study Guide"
            )
            .field(
              "course",
              "CPSC 491"
            )
            .attach(
              "file",

              Buffer.from(
                "Chapter one notes"
              ),

              {
                filename:
                  "chapter-1.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          uploadResponse
            .status
        ).toBe(
          201
        );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .patch(
              `/api/documents/${documentId}`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .send({
              name:
                "chapter-1-review.txt",

              category:
                "Lecture Notes",

              course:
                "CPSC 491 Software Engineering",
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
            .document
            .name
        ).toBe(
          "chapter-1-review.txt"
        );


        expect(
          response.body
            .document
            .category
        ).toBe(
          "Lecture Notes"
        );


        expect(
          response.body
            .document
            .course
        ).toBe(
          "CPSC 491 Software Engineering"
        );


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document.id ===
              documentId
          );


        expect(
          storedDocument
            .name
        ).toBe(
          "chapter-1-review.txt"
        );


        expect(
          storedDocument
            .category
        ).toBe(
          "Lecture Notes"
        );


        expect(
          storedDocument
            .course
        ).toBe(
          "CPSC 491 Software Engineering"
        );
      }
    );


    it(
      "normalizes a cleared course to Unassigned",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .field(
              "course",
              "CPSC 491"
            )
            .attach(
              "file",

              Buffer.from(
                "Course notes"
              ),

              {
                filename:
                  "course-notes.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          uploadResponse
            .status
        ).toBe(
          201
        );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .patch(
              `/api/documents/${documentId}`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .send({
              course:
                "",
            });


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
            .document
            .course
        ).toBe(
          "Unassigned"
        );


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document.id ===
              documentId
          );


        expect(
          storedDocument
            .course
        ).toBe(
          "Unassigned"
        );
      }
    );


    it(
      "does not allow a user to update another user's document",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Private notes"
              ),

              {
                filename:
                  "private.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          uploadResponse
            .status
        ).toBe(
          201
        );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .patch(
              `/api/documents/${documentId}`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-2-token`
            )
            .send({
              name:
                "stolen-name.txt",
            });


        expect(
          response.status
        ).toBe(
          404
        );


        const storedDocument =
          mockDocuments.find(
            (
              document
            ) =>
              document.id ===
              documentId
          );


        expect(
          storedDocument
            .name
        ).toBe(
          "private.txt"
        );
      }
    );


    it(
      "deletes an owned document and its uploaded file",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Temporary notes"
              ),

              {
                filename:
                  "temporary.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          uploadResponse
            .status
        ).toBe(
          201
        );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        expect(
          mockDocuments
        ).toHaveLength(
          1
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          1
        );


        const storedFilename =
          mockDocuments[
            0
          ]
            .stored_filename;


        const storedFilePath =
          path.join(
            tempRoot,
            "uploads",
            storedFilename
          );


        await expect(
          access(
            storedFilePath
          )
        ).resolves
          .toBeUndefined();


        const response =
          await request(
            app
          )
            .delete(
              `/api/documents/${documentId}`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            );


        expect(
          response.status
        ).toBe(
          200
        );


        expect(
          response.body
            .document
            .id
        ).toBe(
          documentId
        );


        expect(
          mockDocuments
        ).toHaveLength(
          0
        );


        await expect(
          access(
            storedFilePath
          )
        ).rejects
          .toThrow();
      }
    );


    it(
      "transitions a document from processing to ready after extraction",

      async () => {
        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Process scheduling determines which task runs next."
              ),

              {
                filename:
                  "scheduling.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(
          201
        );


        expect(
          mockDocumentOperations
        ).toHaveLength(
          3
        );


        const insertOperation =
          mockDocumentOperations[
            0
          ];


        expect(
          insertOperation
            .operation
        ).toBe(
          "insert"
        );


        expect(
          insertOperation
            .data
            .status
        ).toBe(
          "processing"
        );


        expect(
          insertOperation
            .data
            .extracted_text
        ).toBe(
          ""
        );


        expect(
          insertOperation
            .data
            .text_length
        ).toBe(
          0
        );


        const processingUpdate =
          mockDocumentOperations[
            1
          ];


        expect(
          processingUpdate
            .operation
        ).toBe(
          "update"
        );


        expect(
          processingUpdate
            .data
            .status
        ).toBe(
          "processing"
        );


        expect(
          processingUpdate
            .data
            .extraction_error
        ).toBeNull();


        expect(
          processingUpdate
            .data
            .extracted_text
        ).toContain(
          "Process scheduling determines which task runs next."
        );


        expect(
          processingUpdate
            .data
            .text_length
        ).toBeGreaterThan(
          0
        );


        const readyUpdate =
          mockDocumentOperations[
            2
          ];


        expect(
          readyUpdate
            .operation
        ).toBe(
          "update"
        );


        expect(
          readyUpdate
            .data
            .status
        ).toBe(
          "ready"
        );


        expect(
          readyUpdate
            .data
            .extraction_error
        ).toBeNull();


        expect(
          readyUpdate
            .data
            .extracted_text
        ).toContain(
          "Process scheduling determines which task runs next."
        );


        expect(
          readyUpdate
            .data
            .text_length
        ).toBeGreaterThan(
          0
        );


        expect(
          response.body
            .document
            .status
        ).toBe(
          "ready"
        );
      }
    );


    it(
      "removes the local file when document persistence fails",

      async () => {
        failNextDocumentInsert =
          true;


        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Persistence failure test"
              ),

              {
                filename:
                  "failure.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(
          500
        );


        const files =
          await readdir(
            path.join(
              tempRoot,
              "uploads"
            )
          ).catch(
            () => []
          );


        expect(
          files
        ).toHaveLength(
          0
        );


        expect(
          mockDocuments
        ).toHaveLength(
          0
        );
      }
    );


    it(
      "marks a document failed when chunk persistence fails",

      async () => {
        failNextChunkInsert =
          true;


        const response =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Chunk persistence failure test"
              ),

              {
                filename:
                  "chunk-failure.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(
          500
        );


        expect(
          mockDocuments
        ).toHaveLength(
          1
        );


        expect(
          mockDocuments[
            0
          ].status
        ).toBe(
          "failed"
        );


        expect(
          mockDocuments[
            0
          ].extraction_error
        ).toBe(
          "Chunk persistence failed."
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          0
        );
      }
    );




    it(
      "processes a large TXT document and persists multiple chunks",
      async () => {
        const largeText =
          "Operating systems scheduling and memory management. "
            .repeat(
              50000
            );


        const response =
          await request(app)
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                largeText
              ),

              {
                filename:
                  "large-notes.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(201);

        expect(
          response.body
            .document
            .status
        ).toBe("ready");

        expect(
          response.body
            .document
            .textLength
        ).toBeGreaterThan(
          100000
        );

        expect(
          mockDocumentChunks
            .length
        ).toBeGreaterThan(
          1
        );

        expect(
          mockDocumentChunks[0]
            .chunk_index
        ).toBe(0);

        expect(
          mockDocumentChunks[
            mockDocumentChunks
              .length - 1
          ].document_id
        ).toBe(
          response.body
            .document
            .id
        );
      }
    );




    it(
      "rejects a document larger than the upload limit",
      async () => {
        const oversizedFile =
          Buffer.alloc(
            10 * 1024 * 1024 + 1,
            "a"
          );


        const response =
          await request(app)
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",
              oversizedFile,
              {
                filename:
                  "too-large.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          response.status
        ).toBe(413);

        expect(
          response.body.error
        ).toMatch(
          /maximum size is 10 mb/i
        );

        expect(
          mockDocuments
        ).toHaveLength(0);

        expect(
          mockDocumentChunks
        ).toHaveLength(0);
      }
    );


    

    it(
      "does not allow a user to delete another user's document",

      async () => {
        const uploadResponse =
          await request(
            app
          )
            .post(
              "/api/documents"
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-1-token`
            )
            .attach(
              "file",

              Buffer.from(
                "Private document"
              ),

              {
                filename:
                  "private.txt",

                contentType:
                  "text/plain",
              }
            );


        expect(
          uploadResponse
            .status
        ).toBe(
          201
        );


        const documentId =
          uploadResponse
            .body
            .document
            .id;


        const response =
          await request(
            app
          )
            .delete(
              `/api/documents/${documentId}`
            )
            .set(
              "Cookie",
              `${ACCESS_COOKIE}=student-2-token`
            );


        expect(
          response.status
        ).toBe(
          404
        );


        expect(
          mockDocuments
        ).toHaveLength(
          1
        );


        expect(
          mockDocuments[
            0
          ].id
        ).toBe(
          documentId
        );


        expect(
          mockDocumentChunks
        ).toHaveLength(
          1
        );


        expect(
          mockDocumentChunks[
            0
          ].document_id
        ).toBe(
          documentId
        );
      }
    );
  }
);