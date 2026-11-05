async function parseResponse(
  response
) {
  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error =
      new Error(
        body.error ||
        "Request failed."
      );

    error.status =
      response.status;
    // Preserve safe application error codes for specific UI states.
    error.code = body.code;

    throw error;
  }

  return body;
}


export async function registerAccount({
  name,
  email,
  password,
}) {

  const response =
    await fetch(
      "/api/auth/register",
      {
        method: "POST",

        credentials:
          "same-origin",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            name,
            email,
            password,
          }),
      }
    );

  return parseResponse(
    response
  );
}


export async function loginAccount({
  email,
  password,
}) {

  const response =
    await fetch(
      "/api/auth/login",
      {
        method: "POST",

        credentials:
          "same-origin",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            email,
            password,
          }),
      }
    );

  return parseResponse(
    response
  );
}


export async function getCurrentUser() {
  const response =
    await fetch(
      "/api/auth/me",
      {
        credentials:
          "same-origin",
      }
    );

  return parseResponse(
    response
  );
}


export async function logoutAccount() {
  const response =
    await fetch(
      "/api/auth/logout",
      {
        method: "POST",

        credentials:
          "same-origin",
      }
    );

  return parseResponse(
    response
  );
}


export async function verifyEmail({ email, code }) {
  const response = await fetch("/api/auth/verify-email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return parseResponse(response);
}



export async function requestPasswordRecovery({ email }) {
  const response = await fetch("/api/auth/password-recovery", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse(response);
}

// Recovery tokens are held in memory only and sent to the backend over HTTPS
// (or the Vite localhost development proxy). Never place them in URLs/logs.
export async function validatePasswordRecovery({ accessToken, refreshToken }) {
  const response = await fetch("/api/auth/password-recovery/validate", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken }),
  });
  return parseResponse(response);
}

export async function completePasswordReset({ accessToken, refreshToken, password }) {
  const response = await fetch("/api/auth/password-recovery/complete", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken, password }),
  });
  return parseResponse(response);
}
