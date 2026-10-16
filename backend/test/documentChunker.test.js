import {
  DEFAULT_CHUNK_SIZE,
  chunkDocumentText,
  needsChunking,
  findSentenceBoundary,
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
  "ends a sentence-aware chunk at the nearest sentence boundary",
  () => {
    const text =
      "The operating system schedules processes. Virtual memory allows programs to use logical addresses.";


    const chunks =
      chunkDocumentText(
        text,
        {
          chunkSize:
            60,

          overlap:
            10,

          sentenceAware:
            true,

          sentenceLookback:
            30,
        }
      );


    expect(
      chunks.length
    ).toBeGreaterThan(
      1
    );


    expect(
      chunks[0].content
    ).toBe(
      "The operating system schedules processes."
    );


    expect(
      chunks[0].endOffset
    ).toBe(
      "The operating system schedules processes."
        .length
    );
  }
);


it(
  "falls back to the hard chunk boundary when no sentence boundary exists",
  () => {
    const text =
      "abcdefghijklmnopqrstuvwxyz";


    const chunks =
      chunkDocumentText(
        text,
        {
          chunkSize:
            10,

          overlap:
            2,

          sentenceAware:
            true,

          sentenceLookback:
            5,
        }
      );


    expect(
      chunks[0].content
    ).toBe(
      "abcdefghij"
    );


    expect(
      chunks[0].endOffset
    ).toBe(
      10
    );
  }
);


it(
  "recognizes question marks and exclamation points as sentence boundaries",
  () => {
    const text =
      "What is virtual memory? It allows flexible memory usage! Another sentence follows.";


    const chunks =
      chunkDocumentText(
        text,
        {
          chunkSize:
            35,

          overlap:
            5,

          sentenceAware:
            true,

          sentenceLookback:
            20,
        }
      );


    expect(
      chunks[0].content
    ).toBe(
      "What is virtual memory?"
    );
  }
);


it(
  "preserves overlap after using a sentence-aware boundary",
  () => {
    const text =
      "Operating systems schedule processes. Memory management keeps programs isolated. File systems organize persistent data.";


    const chunks =
      chunkDocumentText(
        text,
        {
          chunkSize:
            65,

          overlap:
            10,

          sentenceAware:
            true,

          sentenceLookback:
            30,
        }
      );


    expect(
      chunks.length
    ).toBeGreaterThan(
      1
    );


    expect(
      chunks[1].startOffset
    ).toBe(
      chunks[0].endOffset -
      10
    );
  }
);


it(
  "does not choose a sentence boundary that would break overlap progress",
  () => {
    const text =
      "Short. abcdefghijklmnopqrstuvwxyz";


    const chunks =
      chunkDocumentText(
        text,
        {
          chunkSize:
            15,

          overlap:
            10,

          sentenceAware:
            true,

          sentenceLookback:
            15,
        }
      );


    expect(
      chunks[0].endOffset
    ).toBe(
      15
    );


    expect(
      chunks.length
    ).toBeGreaterThan(
      1
    );
  }
);


it(
  "rejects invalid sentence lookback values",
  () => {
    expect(
      () =>
        chunkDocumentText(
          "test content",
          {
            sentenceLookback:
              -1,
          }
        )
    ).toThrow(
      /sentenceLookback must be a non-negative integer/i
    );
  }
);


    it(
    "finds a sentence boundary within the configured lookback window",
    () => {
        const text =
        "First sentence. Second sentence continues here.";


        const boundary =
        findSentenceBoundary(
            text,
            0,
            35,
            {
            lookback:
                25,

            overlap:
                5,
            }
        );


        expect(
        text.slice(
            0,
            boundary
        )
        ).toBe(
        "First sentence."
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