const ALLOWED_EXTENSIONS = [".txt", ".pdf"];
const ALLOWED_MIME_TYPES = ["text/plain", "application/pdf"];

export function isSupportedDocument(file) {
  const lowerName = file.name.toLowerCase();

  const validExtension = ALLOWED_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );

  const validMime =
    !file.type || ALLOWED_MIME_TYPES.includes(file.type);

  return validExtension && validMime;
}