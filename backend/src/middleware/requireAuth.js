import {
  createSupabaseClient,
} from "../config/supabase.js";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setSessionCookies,
  clearSessionCookies,
} from "../auth/sessionCookies.js";

export async function requireAuth(
  req,
  res,
  next
) {
  try {
    const accessToken =
      req.cookies?.[ACCESS_COOKIE];

    const refreshToken =
      req.cookies?.[REFRESH_COOKIE];

    const supabase =
      createSupabaseClient();

    // Try the existing access token first.
    if (accessToken) {
      const {
        data,
        error,
      } = await supabase.auth.getUser(
        accessToken
      );

      if (!error && data.user) {
        req.user = data.user;
        req.accessToken = accessToken;

        return next();
      }
    }

    // If the access token is expired or invalid,
    // try refreshing the session with the refresh token.
    if (refreshToken) {
      const {
        data,
        error,
      } =
        await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (
        !error &&
        data.session &&
        data.user
      ) {
        setSessionCookies(
          res,
          data.session
        );

        // refreshSession() has already validated the
        // refresh token with Supabase Auth and returned
        // the refreshed user and session, so another
        // getUser() request is unnecessary here.
        req.user = data.user;
        req.accessToken =
          data.session.access_token;

        return next();
      }
    }

    // No valid session could be established.
    clearSessionCookies(res);

    return res.status(401).json({
      error: "Authentication required.",
    });
  } catch (error) {
    next(error);
  }
}
