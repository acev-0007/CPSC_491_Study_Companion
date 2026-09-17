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

    // First try the existing access token.
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

    // If the access token expired,
    // try refreshing the session.
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

        const {
          data: verifiedData,
          error: verificationError,
        } = await supabase.auth.getUser(
          data.session.access_token
        );

        if (
          !verificationError &&
          verifiedData.user
        ) {
          req.user =
            verifiedData.user;

          req.accessToken =
            data.session.access_token;

          return next();
        }
      }
    }

    clearSessionCookies(res);

    return res.status(401).json({
      error: "Authentication required.",
    });
  } catch (error) {
    next(error);
  }
}
