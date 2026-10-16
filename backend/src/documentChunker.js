export const DEFAULT_CHUNK_SIZE = 4000;
export const DEFAULT_CHUNK_OVERLAP = 400;
export const DEFAULT_SENTENCE_LOOKBACK = 500;


export function normalizeDocumentText(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


export function validateChunkOptions({
  chunkSize,
  overlap,
  sentenceLookback,
}) {
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize <= 0
  ) {
    throw new Error(
      "chunkSize must be a positive integer."
    );
  }

  if (
    !Number.isInteger(overlap) ||
    overlap < 0
  ) {
    throw new Error(
      "overlap must be a non-negative integer."
    );
  }

  if (overlap >= chunkSize) {
    throw new Error(
      "overlap must be smaller than chunkSize."
    );
  }

  if (
    !Number.isInteger(sentenceLookback) ||
    sentenceLookback < 0
  ) {
    throw new Error(
      "sentenceLookback must be a non-negative integer."
    );
  }
}


export function needsChunking(
  text,
  chunkSize = DEFAULT_CHUNK_SIZE
) {
  const normalizedText =
    normalizeDocumentText(text);

  return (
    normalizedText.length >
    chunkSize
  );
}


export function findSentenceBoundary(
  text,
  startOffset,
  targetEndOffset,
  {
    lookback =
      DEFAULT_SENTENCE_LOOKBACK,

    overlap =
      DEFAULT_CHUNK_OVERLAP,
  } = {}
) {
  const minimumBoundary =
    Math.max(
      startOffset +
        overlap +
        1,

      targetEndOffset -
        lookback
    );


  for (
    let index =
      targetEndOffset - 1;

    index >= minimumBoundary;

    index -= 1
  ) {
    const character =
      text[index];

    if (
      character !== "." &&
      character !== "!" &&
      character !== "?"
    ) {
      continue;
    }


    const nextCharacter =
      text[
        index + 1
      ];


    if (
      nextCharacter ===
        undefined ||
      /\s/.test(
        nextCharacter
      )
    ) {
      return (
        index + 1
      );
    }
  }


  return targetEndOffset;
}


export function chunkDocumentText(
  text,
  {
    chunkSize =
      DEFAULT_CHUNK_SIZE,

    overlap =
      DEFAULT_CHUNK_OVERLAP,

    sentenceAware =
      false,

    sentenceLookback =
      DEFAULT_SENTENCE_LOOKBACK,
  } = {}
) {
  validateChunkOptions({
    chunkSize,
    overlap,
    sentenceLookback,
  });


  const normalizedText =
    normalizeDocumentText(text);


  if (!normalizedText) {
    return [];
  }


  const chunks = [];

  let startOffset = 0;
  let chunkIndex = 0;


  while (
    startOffset <
    normalizedText.length
  ) {
    const targetEndOffset =
      Math.min(
        startOffset +
          chunkSize,

        normalizedText.length
      );


    let endOffset =
      targetEndOffset;


    if (
      sentenceAware &&
      targetEndOffset <
        normalizedText.length
    ) {
      endOffset =
        findSentenceBoundary(
          normalizedText,
          startOffset,
          targetEndOffset,
          {
            lookback:
              sentenceLookback,

            overlap,
          }
        );
    }


    const content =
      normalizedText
        .slice(
          startOffset,
          endOffset
        )
        .trim();


    if (content) {
      chunks.push({
        chunkIndex,
        content,
        startOffset,
        endOffset,
      });

      chunkIndex += 1;
    }


    if (
      endOffset >=
      normalizedText.length
    ) {
      break;
    }


    startOffset =
      endOffset -
      overlap;
  }


  return chunks;
}