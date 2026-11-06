const LOCAL_USER_ID = "local-user";

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.error || "Request failed.");
    // Preserve the HTTP status so callers can map it to a safe message.
    error.status = response.status;
    throw error;
  }

  return body;
}

export async function listDocuments() {
  const response = await fetch("/api/documents", {
    headers: { "X-User-Id": LOCAL_USER_ID },
  });

  const body = await parseResponse(response);
  return body.documents;
}

/**
 * FLASH-11: retrieves the AI-ready extracted text for one Document Hub file.
 *
 * Relies on the session cookie only. No user ID is sent: the backend must
 * derive ownership from the authenticated session. The route
 * (GET /api/documents/:id/ai-content) is a proposed contract and is not yet
 * exposed by the backend snapshot; see docs/FLASH-11-document-hub-integration.md.
 *
 * Resolves with the response body. Rejects with an Error carrying `.status`
 * for non-2xx responses; network failures reject with fetch's own error.
 */
export async function getDocumentAiContent(id, { signal } = {}) {
  const response = await fetch(
    `/api/documents/${encodeURIComponent(id)}/ai-content`,
    { credentials: "same-origin", signal }
  );

  return parseResponse(response);
}

export async function uploadDocument(file, category, course) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("category", category);
  formData.append("course", course);

  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "X-User-Id": LOCAL_USER_ID },
    body: formData,
  });

  const body = await parseResponse(response);
  return body.document;
}


export async function updateDocument(id, updates) {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": LOCAL_USER_ID,
    },
    body: JSON.stringify(updates),
  });

  const body = await parseResponse(response);
  return body.document;
}

export async function deleteDocument(id) {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    headers: {
      "X-User-Id": LOCAL_USER_ID,
    },
  });

  const body = await parseResponse(response);
  return body.document;
}

export async function getAiReadyDocumentContent(id) {
  const response = await fetch(
    `/api/documents/${encodeURIComponent(id)}/ai-content`,
    {
      credentials: "same-origin",
    }
  );

  return parseResponse(response);
}
