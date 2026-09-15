import path from "node:path";
import { PDFParse } from "pdf-parse";

export const SUPPORTED_EXTENSIONS = new Set([".txt", ".pdf"]);
export const SUPPORTED_MIME_TYPES = new Set(["text/plain", "application/pdf"]);

export function validateSupportedFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Only TXT and PDF files are allowed.");
  }

  // Browsers normally send these MIME types. We still validate the extension,
  // because MIME type alone is user-controlled metadata.
  if (mimeType && !SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported file type. Only TXT and PDF files are allowed.");
  }

  if (extension === ".txt" && mimeType && mimeType !== "text/plain") {
    throw new Error("The uploaded file extension and MIME type do not match.");
  }

  if (extension === ".pdf" && mimeType && mimeType !== "application/pdf") {
    throw new Error("The uploaded file extension and MIME type do not match.");
  }

  return extension;
}

export async function extractText(file) {
  const extension = validateSupportedFile(file);

  if (extension === ".txt") {
    const text = file.buffer.toString("utf8").trim();
    if (!text) throw new Error("No readable text was found in the TXT file.");
    return text;
  }

  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    if (!text) throw new Error("No readable text was found in the PDF.");
    return text;
  } finally {
    await parser.destroy();
  }
}
