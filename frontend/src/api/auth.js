async function parseResponse(
  response
) {
  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error ||
      "Request failed."
    );
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
