import { createHash } from "node:crypto";

// Best-effort, per-process duplicate-request protection. Supabase remains the
// authoritative distributed rate limiter (across instances and restarts).
export const CONFIRMATION_COOLDOWN_MS = 60_000;
const expirationByEmail = new Map();
const MAX_ENTRIES = 10_000;

function keyFor(email) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function prune(now) {
  for (const [key, expiresAt] of expirationByEmail) {
    if (expiresAt <= now) expirationByEmail.delete(key);
  }
  // Avoid unbounded memory growth under a high volume of distinct addresses.
  while (expirationByEmail.size >= MAX_ENTRIES) {
    expirationByEmail.delete(expirationByEmail.keys().next().value);
  }
}

export function remainingConfirmationCooldown(email, now = Date.now()) {
  return Math.max(0, (expirationByEmail.get(keyFor(email)) ?? 0) - now);
}

export function startConfirmationCooldown(email, now = Date.now()) {
  prune(now);
  expirationByEmail.set(keyFor(email), now + CONFIRMATION_COOLDOWN_MS);
}

export function clearConfirmationCooldown(email) {
  expirationByEmail.delete(keyFor(email));
}

// Test-only reset, called explicitly from the auth route test suite.
export function resetConfirmationCooldownForTests() {
  expirationByEmail.clear();
}
