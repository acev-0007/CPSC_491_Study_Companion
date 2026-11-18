async function parse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (body.error) throw new Error(body.error);
    if (response.status === 404) throw new Error("Account settings endpoint not found. Restart the updated backend server.");
    if (response.status === 401) throw new Error("Your session has expired. Sign in again to save your preference.");
    throw new Error(`Unable to complete account request (HTTP ${response.status}).`);
  }
  return body;
}
export async function getAccount() {
  return parse(await fetch("/api/account", { credentials: "same-origin" }));
}
export async function updateAccount(displayName) {
  return parse(await fetch("/api/account", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) }));
}
export async function uploadAvatar(file) {
  const form = new FormData(); form.append("avatar", file);
  return parse(await fetch("/api/account/avatar", { method: "POST", credentials: "same-origin", body: form }));
}
export async function removeAvatar() {
  return parse(await fetch("/api/account/avatar", { method: "DELETE", credentials: "same-origin" }));
}

export async function updatePreferences(theme) {
  return parse(await fetch("/api/account", {
    method: "PATCH", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }),
  }));
}
