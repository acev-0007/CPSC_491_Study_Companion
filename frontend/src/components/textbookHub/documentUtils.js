const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALLOWED_EXTENSIONS = [
  ".txt",
  ".pdf",
  ".docx",
];

const ALLOWED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  DOCX_MIME_TYPE,
];

export function isSupportedDocument(file) {
  const lowerName = file.name.toLowerCase();

  const validExtension = ALLOWED_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );

  const validMime =
    !file.type || ALLOWED_MIME_TYPES.includes(file.type);

  return validExtension && validMime;
}