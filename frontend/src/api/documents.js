const LOCAL_USER_ID = "local-user";

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || "Request failed.");
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

export async function uploadDocument(file, category) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("category", category);

  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "X-User-Id": LOCAL_USER_ID },
    body: formData,
  });

  const body = await parseResponse(response);
  return body.document;
}