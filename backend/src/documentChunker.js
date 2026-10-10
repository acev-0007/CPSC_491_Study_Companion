export const DEFAULT_CHUNK_SIZE = 4000;
export const DEFAULT_CHUNK_OVERLAP = 400;


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


export function chunkDocumentText(
  text,
  {
    chunkSize =
      DEFAULT_CHUNK_SIZE,

    overlap =
      DEFAULT_CHUNK_OVERLAP,
  } = {}
) {
  validateChunkOptions({
    chunkSize,
    overlap,
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
    const endOffset =
      Math.min(
        startOffset +
          chunkSize,
        normalizedText.length
      );

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