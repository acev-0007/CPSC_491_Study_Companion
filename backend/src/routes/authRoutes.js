import express from "express";

import {
  createSupabaseClient,
} from "../config/supabase.js";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setSessionCookies,
  clearSessionCookies,
} from "../auth/sessionCookies.js";

import {
  requireAuth,
} from "../middleware/requireAuth.js";

const router = express.Router();

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName:
      user.user_metadata?.display_name ||
      "",
  };
}


// ========================================
// PASSWORD RECOVERY EMAIL REQUEST (SCRUM-264)
// Public endpoint: never disclose whether an account exists.
// ========================================

const RECOVERY_CONFIRMATION =
  "If an account exists for that email address, we've sent password reset instructions.";

router.post("/password-recovery", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    // The recovery destination is configured on the server, not provided by
    // the caller. Keep it on an allowed Supabase Auth redirect URL list.
    const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    let redirectTo;
    try {
      const parsed = new URL(frontendOrigin);
      if (!(["http:", "https:"].includes(parsed.protocol)) ||
          (parsed.protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") ||
          parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
        throw new Error("invalid origin");
      }
      redirectTo = `${parsed.origin}/reset-password`;
    } catch {
      return res.status(503).json({ error: "Password recovery is not configured. Please try again later." });
    }

    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      const status = Number(error.status);
      const code = String(error.code || "").toLowerCase();
      // Account-not-found responses must be indistinguishable from success.
      if (status === 404 || code === "user_not_found" || code === "email_not_found") {
        return res.json({ message: RECOVERY_CONFIRMATION });
      }
      if (status === 429 || code.includes("rate_limit") || code.includes("over_email_send_rate_limit")) {
        return res.status(429).json({
          error: "Too many recovery requests. Please try again later.",
        });
      }
      return res.status(503).json({
        error: "Unable to request password recovery right now. Please try again later.",
      });
    }

    return res.json({ message: RECOVERY_CONFIRMATION });
  } catch (error) {
    next(error);
  }
});

// ========================================
// PASSWORD RESET COMPLETION (SCRUM-292)
// Validate a recovery session without creating an application login cookie.
// Only a verified Supabase session can change a password.
// ========================================
function recoveryCredentials(body) {
  const accessToken = body?.accessToken;
  const refreshToken = body?.refreshToken;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" ||
      !accessToken || !refreshToken || accessToken.length > 8192 || refreshToken.length > 8192) {
    return null;
  }
  return { access_token: accessToken, refresh_token: refreshToken };
}

async function establishRecoverySession(body) {
  const tokens = recoveryCredentials(body);
  if (!tokens) return { invalid: true };

  const client = createSupabaseClient();
  const { data, error } = await client.auth.setSession(tokens);
  if (error || !data?.session || !data?.user) {
    const status = Number(error?.status);
    return { invalid: status !== 429 && status !== 500 && status !== 503,
      rateLimited: status === 429, unavailable: status === 500 || status === 503 };
  }
  // Verify the session against Supabase instead of trusting claims supplied by a caller.
  const verified = await client.auth.getUser(data.session.access_token);
  if (verified.error || !verified.data?.user || verified.data.user.id !== data.user.id) {
    return { invalid: true };
  }
  return { client };
}

function respondRecoveryFailure(res, result) {
  if (result.rateLimited) return res.status(429).json({ error: "Too many attempts. Please try again later." });
  if (result.unavailable) return res.status(503).json({ error: "Recovery is temporarily unavailable." });
  return res.status(401).json({ error: "Recovery link is invalid or expired." });
}

router.post("/password-recovery/validate", async (req, res) => {
  const tokens = recoveryCredentials(req.body);
  if (!tokens) return res.status(401).json({ error: "Recovery link is invalid or expired." });
  try {
    // Checking an access token directly avoids rotating the refresh token
    // before the user submits their new password.
    const client = createSupabaseClient();
    const { data, error } = await client.auth.getUser(tokens.access_token);
    if (error || !data?.user) {
      const status = Number(error?.status);
      if (status === 429) return res.status(429).json({ error: "Too many attempts. Please try again later." });
      if (status === 500 || status === 503) return res.status(503).json({ error: "Recovery is temporarily unavailable." });
      return res.status(401).json({ error: "Recovery link is invalid or expired." });
    }
    return res.json({ valid: true });
  } catch {
    return res.status(503).json({ error: "Recovery is temporarily unavailable." });
  }
});

router.post("/password-recovery/complete", async (req, res) => {
  const password = req.body?.password;
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
  }
  try {
    const recovery = await establishRecoverySession(req.body);
    if (!recovery.client) return respondRecoveryFailure(res, recovery);
    const { error } = await recovery.client.auth.updateUser({ password });
    if (error) {
      const status = Number(error.status);
      // Supabase checks the submitted password against the current password
      // hash. Never store or compare a plaintext copy in this application.
      if (error.code === "same_password") {
        return res.status(422).json({
          code: "same_password",
          error: "Choose a password different from your current password.",
        });
      }
      if (status === 429) return res.status(429).json({ error: "Too many attempts. Please try again later." });
      if (status === 400 || status === 422) return res.status(400).json({ error: "Password does not meet the account requirements." });
      if (status === 401 || status === 403) return res.status(401).json({ error: "Recovery link is invalid or expired." });
      return res.status(503).json({ error: "Unable to update password right now." });
    }
    // Do not turn a recovery link into a persisted application login session.
    // The user deliberately signs in after resetting their password.
    clearSessionCookies(res);
    return res.json({ message: "Password updated successfully." });
  } catch {
    return res.status(503).json({ error: "Unable to update password right now." });
  }
});

// ========================================
// REGISTER
// ========================================

router.post(
  "/register",
  async (req, res, next) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            "Name, email, and password are required.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error:
            "Password must be at least 8 characters.",
        });
      }

      const supabase =
        createSupabaseClient();

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email: email
            .trim()
            .toLowerCase(),

          password,

          options: {
            data: {
              display_name:
                name.trim(),
            },
          },
        });

      if (error) {
        const duplicateEmail =
          error.code ===
            "user_already_exists" ||
          error.code ===
            "email_exists" ||
          error.message
            ?.toLowerCase()
            .includes(
              "already registered"
            ) ||
          error.message
            ?.toLowerCase()
            .includes(
              "already exists"
            );

        if (duplicateEmail) {
          return res
            .status(409)
            .json({
              error:
                "An account with this email already exists. Please log in instead.",
            });
        }

        return res
          .status(400)
          .json({
            error: error.message,
          });
      }

      // Supabase may return an obfuscated user rather than an error when
      // signup is attempted with an already-confirmed email address.
      // Such users have an empty identities array; do not treat them as
      // newly registered or send them to the verification page.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return res.status(409).json({
          error: "An account with this email already exists. Please log in instead.",
        });
      }

      if (!data?.user) {
        return res.status(502).json({
          error: "We couldn't complete registration. Please try again.",
        });
      }

      // Only create cookies when signup establishes a valid session.
      if (data.session) {
        setSessionCookies(
          res,
          data.session
        );
      }

      return res
        .status(201)
        .json({
          message: data.session
            ? "Account created successfully."
            : "Check your email to confirm your account.",

          user:
            publicUser(data.user),

          authenticated:
            Boolean(data.session),

          requiresEmailConfirmation:
            !data.session,
        });
    } catch (error) {
      next(error);
    }
  }
);


// ========================================
// VERIFY EIGHT-DIGIT EMAIL CODE
// Supabase generates and validates the one-time code.
// ========================================

router.post("/verify-email", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const code = req.body?.code;

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof code !== "string" || !/^\d{8}$/.test(code)) {
      return res.status(400).json({
        error: "Enter your email address and a valid eight-digit code.",
      });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });

    if (error || !data?.user || !data?.session) {
      return res.status(400).json({
        error: "That code is invalid or has expired. Check the code or request a new one.",
      });
    }

    setSessionCookies(res, data.session);
    return res.json({
      message: "Email verified successfully.",
      user: publicUser(data.user),
      authenticated: true,
    });
  } catch (error) {
    next(error);
  }
});



// ========================================
// LOGIN
// ========================================

router.post(
  "/login",
  async (req, res, next) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error:
            "Email and password are required.",
        });
      }

      const supabase =
        createSupabaseClient();

      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email: email
              .trim()
              .toLowerCase(),

            password,
          });

      if (
        error ||
        !data.session ||
        !data.user
      ) {
        return res.status(401).json({
          error:
            "Invalid email or password.",
        });
      }

      setSessionCookies(
        res,
        data.session
      );

      return res.json({
        message:
          "Login successful.",

        user:
          publicUser(data.user),
      });
    } catch (error) {
      next(error);
    }
  }
);


// ========================================
// CURRENT USER
// ========================================

router.get(
  "/me",
  requireAuth,
  (req, res) => {
    return res.json({
      user:
        publicUser(req.user),
    });
  }
);


// ========================================
// LOGOUT
// ========================================

router.post(
  "/logout",
  async (req, res) => {
    const accessToken =
      req.cookies?.[ACCESS_COOKIE];

    const refreshToken =
      req.cookies?.[REFRESH_COOKIE];

    if (
      accessToken &&
      refreshToken
    ) {
      try {
        const supabase =
          createSupabaseClient();

        const {
          error,
        } =
          await supabase.auth
            .setSession({
              access_token:
                accessToken,

              refresh_token:
                refreshToken,
            });

        if (!error) {
          await supabase.auth.signOut({
            scope: "local",
          });
        }
      } catch (error) {
        console.error(
          "Supabase logout error:",
          error
        );
      }
    }

    clearSessionCookies(res);

    return res.json({
      message:
        "Logged out successfully.",
    });
  }
);

export default router;
