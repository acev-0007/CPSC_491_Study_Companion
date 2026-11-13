import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/requireAuth.js";
import { createSupabaseClient, createUserSupabaseClient } from "../config/supabase.js";

const router = express.Router();
const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024;
const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE, files: 1 } });

// Recognize file contents, not just the client-controlled Content-Type header.
function imageType(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function ownedPath(userId, value) {
  return typeof value === "string" && value.startsWith(`${userId}/`) &&
    /^[-a-zA-Z0-9_/\.]+$/.test(value) && !value.includes("..") ? value : null;
}

async function updateMetadata(req, changes) {
  // supabase.auth.updateUser requires SDK-managed session state. Our app deliberately
  // stores sessions only in HttpOnly cookies, so call the user-scoped Auth REST API.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${req.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { ...req.user.user_metadata, ...changes } }),
  });
  if (!response.ok) throw new Error(`Supabase profile update failed (${response.status}).`);
  return response.json();
}

async function serialize(user, accessToken) {
  const path = ownedPath(user.id, user.user_metadata?.avatar_path);
  let avatarUrl = null;
  if (path) {
    const client = createUserSupabaseClient(accessToken);
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (!error) avatarUrl = data?.signedUrl ?? null;
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || "",
    createdAt: user.created_at,
    avatarUrl,
  };
}

// SCRUM-282: Password changes require a valid session AND proof of the current password.
// Verify on a separate stateless Supabase client, never replacing the caller's cookies.
router.patch("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ error: "Enter your current password." });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: "New password must contain 8–128 characters." });
  }
  if (typeof confirmPassword !== "string" || newPassword !== confirmPassword) {
    return res.status(400).json({ error: "New passwords do not match." });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "Choose a password different from your current password." });
  }

  try {
    const verifier = createSupabaseClient();
    const { data, error } = await verifier.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });
    if (error || data?.user?.id !== req.user.id) {
      const throttled = Number(error?.status) === 429;
      return res.status(throttled ? 429 : 400).json({
        error: throttled ? "Too many attempts. Try again later." : "Current password is incorrect.",
      });
    }

    // The Auth REST endpoint uses the user's existing verified access token.
    // Include current_password so projects with Supabase's security toggle enabled
    // also enforce their native current-password protection.
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${req.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: newPassword, current_password: currentPassword }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const code = String(result.code || "");
      if (code === "same_password") return res.status(400).json({ error: "Choose a different password." });
      if (code === "weak_password") return res.status(400).json({ error: "Password does not meet security requirements." });
      if (code === "current_password_mismatch" || code === "current_password_required") {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
      if (response.status === 429) return res.status(429).json({ error: "Too many attempts. Try again later." });
      if (response.status === 401 || response.status === 403) return res.status(401).json({ error: "Session expired. Please sign in again." });
      return res.status(502).json({ error: "Unable to update password. Please try again." });
    }
    // Do not echo user details, credentials, or tokens returned by Supabase.
    return res.json({ message: "Password updated successfully." });
  } catch {
    // Never log request bodies or upstream auth errors that might include credentials.
    return res.status(502).json({ error: "Unable to update password. Please try again." });
  }
});

router.use(requireAuth);
router.get("/", async (req, res, next) => {
  try { res.json({ user: await serialize(req.user, req.accessToken) }); } catch (error) { next(error); }
});

router.patch("/", async (req, res) => {
  const { displayName } = req.body ?? {};
  if (typeof displayName !== "string" || !displayName.trim() || displayName.trim().length > 80) {
    return res.status(400).json({ error: "Display name must contain 1–80 characters." });
  }
  try {
    const user = await updateMetadata(req, { display_name: displayName.trim() });
    return res.json({ user: await serialize(user, req.accessToken) });
  } catch (error) {
    console.error("Account display-name update failed:", error);
    return res.status(502).json({ error: "Unable to update your name. Please try again." });
  }
});

router.post("/avatar", (req, res, next) => {
  upload.single("avatar")(req, res, error => {
    if (error) return res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Image must be 2 MB or smaller." : "Unable to process this image upload." });
    next();
  });
}, async (req, res) => {
  if (!req.file || !types[req.file.mimetype] || imageType(req.file.buffer) !== req.file.mimetype) {
    return res.status(400).json({ error: "Choose a valid JPEG, PNG, or WebP image." });
  }
  const client = createUserSupabaseClient(req.accessToken);
  const oldPath = ownedPath(req.user.id, req.user.user_metadata?.avatar_path);
  const path = `${req.user.id}/${randomUUID()}.${types[req.file.mimetype]}`;
  try {
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype, upsert: false, cacheControl: "3600",
    });
    if (uploadError) throw uploadError;
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return res.status(502).json({ error: "Unable to upload your image. Please try again." });
  }
  let user;
  try {
    user = await updateMetadata(req, { avatar_path: path });
  } catch (error) {
    await client.storage.from(BUCKET).remove([path]).catch(() => {});
    console.error("Avatar metadata update failed:", error);
    return res.status(502).json({ error: "Unable to save your profile image." });
  }
  if (oldPath && oldPath !== path) {
    const { error } = await client.storage.from(BUCKET).remove([oldPath]);
    if (error) console.error("Old avatar cleanup failed:", error);
  }
  try { return res.json({ user: await serialize(user, req.accessToken) }); }
  catch (error) { console.error("Avatar URL generation failed:", error); return res.status(502).json({ error: "Image saved, but it could not be displayed. Refresh your profile." }); }
});

router.delete("/avatar", async (req, res) => {
  const oldPath = ownedPath(req.user.id, req.user.user_metadata?.avatar_path);
  try {
    // Clear the reference first, so a storage failure never leaves a broken avatar selected.
    const user = await updateMetadata(req, { avatar_path: null });
    if (oldPath) {
      const client = createUserSupabaseClient(req.accessToken);
      const { error } = await client.storage.from(BUCKET).remove([oldPath]);
      if (error) console.error("Avatar removal cleanup failed:", error);
    }
    return res.json({ user: await serialize(user, req.accessToken) });
  } catch (error) {
    console.error("Avatar removal failed:", error);
    return res.status(502).json({ error: "Unable to remove your profile image." });
  }
});

export default router;
