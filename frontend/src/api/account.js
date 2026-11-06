async function parse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
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
