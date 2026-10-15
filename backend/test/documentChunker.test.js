import {
  DEFAULT_CHUNK_SIZE,
  chunkDocumentText,
  needsChunking,
  normalizeDocumentText,
} from "../src/documentChunker.js";

import {
  describe,
  expect,
  it,
} from "vitest";


describe(
  "documentChunker",
  () => {
    it(
      "normalizes line endings and repeated whitespace",
      () => {
        const input =
          "First line\r\n\r\n\r\nSecond\t\tline   here\rThird line";

        const result =
          normalizeDocumentText(
            input
          );


        expect(
          result
        ).toBe(
          "First line\n\nSecond line here\nThird line"
        );
      }
    );


    it(
      "returns no chunks for empty content",
      () => {
        const chunks =
          chunkDocumentText(
            ""
          );


        expect(
          chunks
        ).toEqual([]);
      }
    );


    it(
      "keeps a short document in one chunk",
      () => {
        const text =
          "A short document for testing.";

        const chunks =
          chunkDocumentText(
            text
          );


        expect(
          chunks
        ).toHaveLength(1);

        expect(
          chunks[0].chunkIndex
        ).toBe(0);

        expect(
          chunks[0].content
        ).toBe(text);

        expect(
          chunks[0].startOffset
        ).toBe(0);

        expect(
          chunks[0].endOffset
        ).toBe(
          text.length
        );
      }
    );


    it(
      "detects when a document exceeds the default chunk size",
      () => {
        const text =
          "a".repeat(
            DEFAULT_CHUNK_SIZE + 1
          );


        expect(
          needsChunking(
            text
          )
        ).toBe(true);
      }
    );


    it(
      "does not require chunking at exactly the default chunk size",
      () => {
        const text =
          "a".repeat(
            DEFAULT_CHUNK_SIZE
          );


        expect(
          needsChunking(
            text
          )
        ).toBe(false);
      }
    );


    it(
      "splits a large document into overlapping chunks",
      () => {
        const text =
          "a".repeat(
            10000
          );


        const chunks =
          chunkDocumentText(
            text
          );


        expect(
          chunks.length
        ).toBeGreaterThan(1);


        for (
          let index = 0;
          index <
          chunks.length;
          index += 1
        ) {
          expect(
            chunks[index]
              .chunkIndex
          ).toBe(index);

          expect(
            chunks[index]
              .content.length
          ).toBeLessThanOrEqual(
            DEFAULT_CHUNK_SIZE
          );

          expect(
            chunks[index]
              .endOffset
          ).toBeGreaterThan(
            chunks[index]
              .startOffset
          );
        }


        expect(
          chunks[1]
            .startOffset
        ).toBe(
          chunks[0]
            .endOffset -
          400
        );
      }
    );


    it(
      "handles a very large document without losing the final content",
      () => {
        const text =
          "0123456789"
            .repeat(
              100000
            );


        const chunks =
          chunkDocumentText(
            text
          );


        expect(
          chunks.length
        ).toBeGreaterThan(
          100
        );


        const finalChunk =
          chunks[
            chunks.length - 1
          ];


        expect(
          finalChunk.endOffset
        ).toBe(
          text.length
        );

        expect(
          finalChunk.content
            .length
        ).toBeGreaterThan(
          0
        );
      }
    );


    it(
      "supports custom chunk sizes and overlap values",
      () => {
        const text =
          "abcdefghij";


        const chunks =
          chunkDocumentText(
            text,
            {
              chunkSize:
                5,

              overlap:
                2,
            }
          );


        expect(
          chunks
        ).toHaveLength(3);

        expect(
          chunks[0].content
        ).toBe("abcde");

        expect(
          chunks[1].content
        ).toBe("defgh");

        expect(
          chunks[2].content
        ).toBe("ghij");
      }
    );


    it(
      "rejects an overlap equal to the chunk size",
      () => {
        expect(
          () =>
            chunkDocumentText(
              "test content",
              {
                chunkSize:
                  100,

                overlap:
                  100,
              }
            )
        ).toThrow(
          /overlap must be smaller/i
        );
      }
    );


    it(
      "rejects invalid chunk sizes",
      () => {
        expect(
          () =>
            chunkDocumentText(
              "test content",
              {
                chunkSize:
                  0,

                overlap:
                  0,
              }
            )
        ).toThrow(
          /chunkSize must be a positive integer/i
        );
      }
    );
  }
);