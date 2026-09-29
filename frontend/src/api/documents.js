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