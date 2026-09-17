export const ACCESS_COOKIE = "asc_access_token";
export const REFRESH_COOKIE = "asc_refresh_token";

const isProduction =
  process.env.NODE_ENV === "production";

const commonCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export function setSessionCookies(res, session) {
  const accessTokenLifetime =
    (session.expires_in || 3600) * 1000;

  res.cookie(
    ACCESS_COOKIE,
    session.access_token,
    {
      ...commonCookieOptions,
      maxAge: accessTokenLifetime,
    }
  );

  res.cookie(
    REFRESH_COOKIE,
    session.refresh_token,
    {
      ...commonCookieOptions,

      // Keep the browser session available for 30 days.
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }
  );
}

export function clearSessionCookies(res) {
  res.clearCookie(
    ACCESS_COOKIE,
    commonCookieOptions
  );

  res.clearCookie(
    REFRESH_COOKIE,
    commonCookieOptions
  );
}
