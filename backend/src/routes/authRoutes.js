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

import {
  clearConfirmationCooldown,
  remainingConfirmationCooldown,
  startConfirmationCooldown,
} from "../auth/confirmationCooldown.js";

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

      // Registration has just requested the initial confirmation email.
      // Count it as the first send so direct API calls cannot bypass the UI timer.
      if (!data.session) {
        startConfirmationCooldown(email);
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
// RESEND SIGNUP CONFIRMATION
// Use a generic response to avoid revealing account existence.
// ========================================

router.post("/resend-confirmation", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const genericMessage = "If another verification email can be sent, please check your inbox shortly.";
    const remaining = remainingConfirmationCooldown(email);
    if (remaining > 0) {
      res.set("Retry-After", String(Math.ceil(remaining / 1000)));
      return res.status(429).json({
        error: "Please wait before requesting another confirmation email.",
      });
    }

    // Reserve immediately, before awaiting Supabase, to prevent concurrent resends.
    startConfirmationCooldown(email);
    let resendResult;
    try {
      const supabase = createSupabaseClient();
      resendResult = await supabase.auth.resend({ type: "signup", email });
    } catch (failure) {
      clearConfirmationCooldown(email);
      throw failure;
    }
    const { error } = resendResult;

    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit" ||
          error.code === "over_request_rate_limit") {
        res.set("Retry-After", "60");
        return res.status(429).json({
          error: "Please wait before requesting another confirmation email.",
        });
      }
      // Missing, confirmed and ineligible accounts get the same neutral answer.
      if (error.status === 400 || error.status === 404 || error.status === 422) {
        return res.json({ message: genericMessage });
      }
      // Service errors should not consume a full cooldown unnecessarily.
      clearConfirmationCooldown(email);
      return res.status(503).json({
        error: "We couldn't request another email right now. Please try again later.",
      });
    }

    return res.json({ message: genericMessage });
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
