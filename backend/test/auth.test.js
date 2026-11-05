import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";


// =========================================================
// SUPABASE MOCKS
// =========================================================
//
// vi.hoisted() creates the mock functions before Vitest
// evaluates the imports below.
//
// No real Supabase requests are made by these tests.
// =========================================================

const {
  signUpMock,
  verifyOtpMock,
  signInWithPasswordMock,
  setSessionMock,
  signOutMock,
  getUserMock,
  refreshSessionMock,
} = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  verifyOtpMock: vi.fn(),

  signInWithPasswordMock:
    vi.fn(),

  setSessionMock: vi.fn(),

  signOutMock: vi.fn(),

  getUserMock: vi.fn(),

  refreshSessionMock:
    vi.fn(),
}));


vi.mock(
  "../src/config/supabase.js",
  () => ({
    createSupabaseClient:
      vi.fn(() => ({
        auth: {
          signUp:
            signUpMock,

          verifyOtp: verifyOtpMock,

          signInWithPassword:
            signInWithPasswordMock,

          setSession:
            setSessionMock,

          signOut:
            signOutMock,

          getUser:
            getUserMock,

          refreshSession:
            refreshSessionMock,
        },
      })),

    createUserSupabaseClient:
      vi.fn(),
  })
);


// Import the real authentication routes.
//
// The Supabase module they depend on has already
// been replaced with the mock above.
import authRoutes from
  "../src/routes/authRoutes.js";


// =========================================================
// TEST APPLICATION
// =========================================================
//
// This is a small Express application used only during
// testing.
//
// We are mounting the project's REAL authRoutes here.
//
// Supertest can send HTTP requests directly to this app,
// so the backend server does not need to be running.
// =========================================================

function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use(
    "/api/auth",
    authRoutes
  );


  // Test error handler.
  //
  // This lets us verify that unexpected errors are passed
  // to Express instead of crashing the route/process.
  app.use(
    (error, _req, res, _next) => {
      console.error(
        "Test caught route error:",
        error.message
      );

      return res
        .status(500)
        .json({
          error:
            "Unexpected server error.",
        });
    }
  );

  return app;
}


// =========================================================
// REUSABLE MOCK DATA
// =========================================================

const mockUser = {
  id: "user-123",

  email:
    "student@example.com",

  user_metadata: {
    display_name:
      "Test Student",
  },
};


const mockSession = {
  access_token:
    "test-access-token",

  refresh_token:
    "test-refresh-token",

  expires_in: 3600,
};


// =========================================================
// RESET MOCKS BEFORE EACH TEST
// =========================================================

beforeEach(() => {
  vi.clearAllMocks();
});


// =========================================================
// REGISTRATION TESTS
// =========================================================

describe(
  "POST /api/auth/register",
  () => {

    // -----------------------------------------------------
    // Successful registration
    // -----------------------------------------------------

    it(
      "returns 201 and the expected response for successful registration",
      async () => {

        signUpMock.mockResolvedValue({
          data: {
            user:
              mockUser,

            session:
              mockSession,
          },

          error: null,
        });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send({
              name:
                "Test Student",

              email:
                "student@example.com",

              password:
                "Password123!",
            });


        expect(
          response.status
        ).toBe(201);


        expect(
          response.body
        ).toEqual({
          message:
            "Account created successfully.",

          user: {
            id:
              "user-123",

            email:
              "student@example.com",

            displayName:
              "Test Student",
          },

          authenticated:
            true,

          requiresEmailConfirmation:
            false,
        });
      }
    );


    // -----------------------------------------------------
    // Verify data passed to Supabase
    // -----------------------------------------------------

    it(
      "passes normalized registration data to Supabase",
      async () => {

        signUpMock.mockResolvedValue({
          data: {
            user:
              mockUser,

            session:
              mockSession,
          },

          error: null,
        });


        const app =
          createTestApp();


        await request(app)
          .post(
            "/api/auth/register"
          )
          .send({
            name:
              "  Test Student  ",

            email:
              "  Student@Example.COM  ",

            password:
              "Password123!",
          });


        expect(
          signUpMock
        ).toHaveBeenCalledWith({
          email:
            "student@example.com",

          password:
            "Password123!",

          options: {
            data: {
              display_name:
                "Test Student",
            },
          },
        });
      }
    );


    // -----------------------------------------------------
    // Missing registration fields
    // -----------------------------------------------------

    it.each([
      [
        "name",
        {
          email:
            "student@example.com",

          password:
            "Password123!",
        },
      ],

      [
        "email",
        {
          name:
            "Test Student",

          password:
            "Password123!",
        },
      ],

      [
        "password",
        {
          name:
            "Test Student",

          email:
            "student@example.com",
        },
      ],
    ])(
      "returns 400 when %s is missing",
      async (
        _missingField,
        requestBody
      ) => {

        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send(
              requestBody
            );


        expect(
          response.status
        ).toBe(400);


        expect(
          response.body
        ).toEqual({
          error:
            "Name, email, and password are required.",
        });


        // Validation should happen before Supabase
        // is contacted.
        expect(
          signUpMock
        ).not
          .toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Password validation
    // -----------------------------------------------------

    it(
      "returns 400 when the password is shorter than 8 characters",
      async () => {

        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send({
              name:
                "Test Student",

              email:
                "student@example.com",

              password:
                "short",
            });


        expect(
          response.status
        ).toBe(400);


        expect(
          response.body
        ).toEqual({
          error:
            "Password must be at least 8 characters.",
        });


        expect(
          signUpMock
        ).not
          .toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Duplicate email
    // -----------------------------------------------------

    it(
      "returns 409 when the email is already registered",
      async () => {

        signUpMock.mockResolvedValue({
          data: {
            user: null,
            session: null,
          },

          error: {
            code:
              "user_already_exists",

            message:
              "User already registered",
          },
        });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send({
              name:
                "Test Student",

              email:
                "student@example.com",

              password:
                "Password123!",
            });


        expect(
          response.status
        ).toBe(409);


        expect(
          response.body
        ).toEqual({
          error:
            "An account with this email already exists. Please log in instead.",
        });
      }
    );


    // -----------------------------------------------------
    // Registration cookies
    // -----------------------------------------------------

    it(
      "sets authentication cookies when Supabase returns a session",
      async () => {

        signUpMock.mockResolvedValue({
          data: {
            user:
              mockUser,

            session:
              mockSession,
          },

          error: null,
        });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send({
              name:
                "Test Student",

              email:
                "student@example.com",

              password:
                "Password123!",
            });


        const cookies =
          response.headers[
            "set-cookie"
          ];


        expect(
          cookies
        ).toBeDefined();


        const cookieText =
          cookies.join(" ");


        expect(
          cookieText
        ).toContain(
          "asc_access_token=test-access-token"
        );


        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=test-refresh-token"
        );


        expect(
          cookieText
        ).toContain(
          "HttpOnly"
        );


        expect(
          cookieText
        ).toContain(
          "SameSite=Lax"
        );
      }
    );


    // -----------------------------------------------------
    // Unexpected Supabase error
    // -----------------------------------------------------

    it(
      "passes unexpected errors to Express instead of crashing",
      async () => {

        signUpMock
          .mockRejectedValue(
            new Error(
              "Supabase unavailable"
            )
          );


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/register"
            )
            .send({
              name:
                "Test Student",

              email:
                "student@example.com",

              password:
                "Password123!",
            });


        expect(
          response.status
        ).toBe(500);


        expect(
          response.body
        ).toEqual({
          error:
            "Unexpected server error.",
        });
      }
    );
  }
);


// =========================================================
// LOGIN TESTS
// =========================================================

describe(
  "POST /api/auth/login",
  () => {

    // -----------------------------------------------------
    // Successful login
    // -----------------------------------------------------

    it(
      "returns 200 and the expected response for a successful login",
      async () => {

        signInWithPasswordMock
          .mockResolvedValue({
            data: {
              user:
                mockUser,

              session:
                mockSession,
            },

            error: null,
          });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/login"
            )
            .send({
              email:
                "student@example.com",

              password:
                "Password123!",
            });


        expect(
          response.status
        ).toBe(200);


        expect(
          response.body
        ).toEqual({
          message:
            "Login successful.",

          user: {
            id:
              "user-123",

            email:
              "student@example.com",

            displayName:
              "Test Student",
          },
        });
      }
    );


    // -----------------------------------------------------
    // Verify login data passed to Supabase
    // -----------------------------------------------------

    it(
      "passes normalized login credentials to Supabase",
      async () => {

        signInWithPasswordMock
          .mockResolvedValue({
            data: {
              user:
                mockUser,

              session:
                mockSession,
            },

            error: null,
          });


        const app =
          createTestApp();


        await request(app)
          .post(
            "/api/auth/login"
          )
          .send({
            email:
              " Student@Example.COM ",

            password:
              "Password123!",
          });


        expect(
          signInWithPasswordMock
        ).toHaveBeenCalledWith({
          email:
            "student@example.com",

          password:
            "Password123!",
        });
      }
    );


    // -----------------------------------------------------
    // Invalid credentials
    // -----------------------------------------------------

    it(
      "returns 401 when the login credentials are invalid",
      async () => {

        signInWithPasswordMock
          .mockResolvedValue({
            data: {
              user: null,
              session: null,
            },

            error: {
              message:
                "Invalid login credentials",
            },
          });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/login"
            )
            .send({
              email:
                "student@example.com",

              password:
                "WrongPassword123!",
            });


        expect(
          response.status
        ).toBe(401);


        expect(
          response.body
        ).toEqual({
          error:
            "Invalid email or password.",
        });
      }
    );


    // -----------------------------------------------------
    // Missing login credentials
    // -----------------------------------------------------

    it.each([
      [
        "email",
        {
          password:
            "Password123!",
        },
      ],

      [
        "password",
        {
          email:
            "student@example.com",
        },
      ],
    ])(
      "returns 400 when login %s is missing",
      async (
        _missingField,
        requestBody
      ) => {

        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/login"
            )
            .send(
              requestBody
            );


        expect(
          response.status
        ).toBe(400);


        expect(
          response.body
        ).toEqual({
          error:
            "Email and password are required.",
        });


        expect(
          signInWithPasswordMock
        ).not
          .toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Login cookies
    // -----------------------------------------------------

    it(
      "sets authentication cookies after a successful login",
      async () => {

        signInWithPasswordMock
          .mockResolvedValue({
            data: {
              user:
                mockUser,

              session:
                mockSession,
            },

            error: null,
          });


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/login"
            )
            .send({
              email:
                "student@example.com",

              password:
                "Password123!",
            });


        const cookies =
          response.headers[
            "set-cookie"
          ];


        expect(
          cookies
        ).toBeDefined();


        const cookieText =
          cookies.join(" ");


        expect(
          cookieText
        ).toContain(
          "asc_access_token=test-access-token"
        );


        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=test-refresh-token"
        );


        expect(
          cookieText
        ).toContain(
          "HttpOnly"
        );
      }
    );


    // -----------------------------------------------------
    // Unexpected login error
    // -----------------------------------------------------

    it(
      "passes unexpected login errors to Express instead of crashing",
      async () => {

        signInWithPasswordMock
          .mockRejectedValue(
            new Error(
              "Supabase unavailable"
            )
          );


        const app =
          createTestApp();


        const response =
          await request(app)
            .post(
              "/api/auth/login"
            )
            .send({
              email:
                "student@example.com",

              password:
                "Password123!",
            });


        expect(
          response.status
        ).toBe(500);


        expect(
          response.body
        ).toEqual({
          error:
            "Unexpected server error.",
        });
      }
    );
  }
);
// =========================================================
// SCRUM-91: SESSION VALIDATION TESTS
// =========================================================

describe(
  "GET /api/auth/me",
  () => {

    // -----------------------------------------------------
    // Valid access token + valid refresh token
    // -----------------------------------------------------

    it(
      "returns 200 when the access token is valid",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: mockUser,
          },
          error: null,
        });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=valid-access-token",
                "asc_refresh_token=valid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          response.body
        ).toEqual({
          user: {
            id: "user-123",
            email:
              "student@example.com",
            displayName:
              "Test Student",
          },
        });

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "valid-access-token"
        );

        expect(
          refreshSessionMock
        ).not.toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Valid access token + invalid refresh token
    // -----------------------------------------------------

    it(
      "keeps the user authenticated when the access token is valid even if the refresh token is invalid",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: mockUser,
          },
          error: null,
        });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=valid-access-token",
                "asc_refresh_token=invalid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "valid-access-token"
        );

        expect(
          refreshSessionMock
        ).not.toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Missing access token + valid refresh token
    // -----------------------------------------------------

    it(
      "refreshes the session when the access token is missing and the refresh token is valid",
      async () => {
        refreshSessionMock
          .mockResolvedValue({
            data: {
              user: mockUser,

              session: {
                access_token:
                  "new-access-token",

                refresh_token:
                  "new-refresh-token",

                expires_in: 3600,
              },
            },

            error: null,
          });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_refresh_token=valid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          getUserMock
        ).not.toHaveBeenCalled();

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "valid-refresh-token",
        });

        const cookies =
          response.headers[
            "set-cookie"
          ];

        expect(
          cookies
        ).toBeDefined();

        const cookieText =
          cookies.join(" ");

        expect(
          cookieText
        ).toContain(
          "asc_access_token=new-access-token"
        );

        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=new-refresh-token"
        );
      }
    );


    // -----------------------------------------------------
    // Expired access token + valid refresh token
    // -----------------------------------------------------

    it(
      "refreshes the session when the access token is expired and the refresh token is valid",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: null,
          },

          error: {
            message:
              "JWT expired",
          },
        });

        refreshSessionMock
          .mockResolvedValue({
            data: {
              user: mockUser,

              session: {
                access_token:
                  "refreshed-access-token",

                refresh_token:
                  "refreshed-refresh-token",

                expires_in: 3600,
              },
            },

            error: null,
          });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=expired-access-token",
                "asc_refresh_token=valid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "expired-access-token"
        );

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "valid-refresh-token",
        });

        const cookies =
          response.headers[
            "set-cookie"
          ];

        expect(
          cookies
        ).toBeDefined();

        const cookieText =
          cookies.join(" ");

        expect(
          cookieText
        ).toContain(
          "asc_access_token=refreshed-access-token"
        );

        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=refreshed-refresh-token"
        );
      }
    );


    // -----------------------------------------------------
    // Invalid access token + valid refresh token
    // -----------------------------------------------------

    it(
      "refreshes the session when the access token is invalid and the refresh token is valid",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: null,
          },

          error: {
            message:
              "Invalid access token",
          },
        });

        refreshSessionMock
          .mockResolvedValue({
            data: {
              user: mockUser,

              session: {
                access_token:
                  "new-access-token",

                refresh_token:
                  "new-refresh-token",

                expires_in: 3600,
              },
            },

            error: null,
          });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=invalid-access-token",
                "asc_refresh_token=valid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(200);

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "invalid-access-token"
        );

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "valid-refresh-token",
        });

        const cookies =
          response.headers[
            "set-cookie"
          ];

        expect(
          cookies
        ).toBeDefined();

        const cookieText =
          cookies.join(" ");

        expect(
          cookieText
        ).toContain(
          "asc_access_token=new-access-token"
        );

        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=new-refresh-token"
        );
      }
    );


    // -----------------------------------------------------
    // Missing access token + invalid refresh token
    // -----------------------------------------------------

    it(
      "returns 401 and clears stale cookies when the refresh token is invalid",
      async () => {
        refreshSessionMock
          .mockResolvedValue({
            data: {
              user: null,
              session: null,
            },

            error: {
              message:
                "Invalid refresh token",
            },
          });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_refresh_token=invalid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(401);

        expect(
          response.body
        ).toEqual({
          error:
            "Authentication required.",
        });

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "invalid-refresh-token",
        });

        const cookies =
          response.headers[
            "set-cookie"
          ];

        expect(
          cookies
        ).toBeDefined();

        const cookieText =
          cookies.join(" ");

        expect(
          cookieText
        ).toContain(
          "asc_access_token=;"
        );

        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=;"
        );
      }
    );


    // -----------------------------------------------------
    // Invalid access token + invalid refresh token
    // -----------------------------------------------------

    it(
      "returns 401 and clears cookies when both tokens are invalid",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: null,
          },

          error: {
            message:
              "Invalid access token",
          },
        });

        refreshSessionMock
          .mockResolvedValue({
            data: {
              user: null,
              session: null,
            },

            error: {
              message:
                "Invalid refresh token",
            },
          });

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=invalid-access-token",
                "asc_refresh_token=invalid-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(401);

        expect(
          response.body
        ).toEqual({
          error:
            "Authentication required.",
        });

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "invalid-access-token"
        );

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "invalid-refresh-token",
        });

        const cookies =
          response.headers[
            "set-cookie"
          ];

        expect(
          cookies
        ).toBeDefined();

        const cookieText =
          cookies.join(" ");

        expect(
          cookieText
        ).toContain(
          "asc_access_token=;"
        );

        expect(
          cookieText
        ).toContain(
          "asc_refresh_token=;"
        );
      }
    );


    // -----------------------------------------------------
    // Both tokens missing
    // -----------------------------------------------------

    it(
      "returns 401 when both authentication cookies are missing",
      async () => {
        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me");

        expect(
          response.status
        ).toBe(401);

        expect(
          response.body
        ).toEqual({
          error:
            "Authentication required.",
        });

        expect(
          getUserMock
        ).not.toHaveBeenCalled();

        expect(
          refreshSessionMock
        ).not.toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Unexpected Supabase failure during access validation
    // -----------------------------------------------------

    it(
      "returns 500 when access-token verification fails unexpectedly",
      async () => {
        getUserMock.mockRejectedValue(
          new Error(
            "Supabase unavailable"
          )
        );

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=existing-access-token",
                "asc_refresh_token=existing-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(500);

        expect(
          response.body
        ).toEqual({
          error:
            "Unexpected server error.",
        });

        expect(
          refreshSessionMock
        ).not.toHaveBeenCalled();
      }
    );


    // -----------------------------------------------------
    // Unexpected Supabase failure during refresh
    // -----------------------------------------------------

    it(
      "returns 500 when session refresh fails unexpectedly",
      async () => {
        getUserMock.mockResolvedValue({
          data: {
            user: null,
          },

          error: {
            message:
              "Access token expired",
          },
        });

        refreshSessionMock
          .mockRejectedValue(
            new Error(
              "Supabase unavailable"
            )
          );

        const app =
          createTestApp();

        const response =
          await request(app)
            .get("/api/auth/me")
            .set(
              "Cookie",
              [
                "asc_access_token=expired-access-token",
                "asc_refresh_token=existing-refresh-token",
              ]
            );

        expect(
          response.status
        ).toBe(500);

        expect(
          response.body
        ).toEqual({
          error:
            "Unexpected server error.",
        });

        expect(
          getUserMock
        ).toHaveBeenCalledWith(
          "expired-access-token"
        );

        expect(
          refreshSessionMock
        ).toHaveBeenCalledWith({
          refresh_token:
            "existing-refresh-token",
        });
      }
    );
  }
)


// =========================================================
// EIGHT-DIGIT EMAIL VERIFICATION API TESTS (SCRUM-259)
// =========================================================

describe("POST /api/auth/verify-email", () => {
  const validRequest = {
    email: "Student@Example.com ",
    code: "01234567",
  };

  it("verifies a valid code, normalizes email, and establishes a session", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const response = await request(createTestApp())
      .post("/api/auth/verify-email")
      .send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Email verified successfully.",
      user: {
        id: mockUser.id,
        email: mockUser.email,
        displayName: "Test Student",
      },
      authenticated: true,
    });
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: "student@example.com",
      token: "01234567",
      type: "signup",
    });
    const cookies = response.headers["set-cookie"] || [];
    expect(cookies.some((value) => value.startsWith("asc_access_token=") && value.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((value) => value.startsWith("asc_refresh_token=") && value.includes("HttpOnly"))).toBe(true);
  });

  it.each([
    ["missing email", { code: "01234567" }],
    ["invalid email", { email: "not-an-email", code: "01234567" }],
    ["non-string email", { email: 123, code: "01234567" }],
    ["missing code", { email: "student@example.com" }],
    ["short code", { email: "student@example.com", code: "1234567" }],
    ["long code", { email: "student@example.com", code: "123456789" }],
    ["letters in code", { email: "student@example.com", code: "1234abcd" }],
    ["numeric code", { email: "student@example.com", code: 12345678 }],
    ["empty payload", {}],
  ])("rejects %s before contacting Supabase", async (_name, payload) => {
    const response = await request(createTestApp())
      .post("/api/auth/verify-email")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Enter your email address and a valid eight-digit code.",
    });
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it.each(["invalid", "expired", "reused"])(
    "rejects a %s code without establishing a session",
    async () => {
      // Supabase enforces code validity, expiry, and one-time use.
      verifyOtpMock.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "OTP expired or invalid" },
      });
      const response = await request(createTestApp())
        .post("/api/auth/verify-email")
        .send(validRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid or has expired/i);
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  );

  it.each([
    ["leading whitespace", " 01234567"],
    ["trailing whitespace", "01234567 "],
    ["embedded whitespace", "0123 4567"],
    ["Unicode digits", "０１２３４５６７"],
    ["signed digits", "+12345678"],
    ["decimal code", "1234567.8"],
  ])("rejects %s in a verification code before contacting Supabase", async (_label, code) => {
    const response = await request(createTestApp())
      .post("/api/auth/verify-email")
      .send({ email: "student@example.com", code });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Enter your email address and a valid eight-digit code.",
    });
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("allows a corrected code after an invalid attempt without creating an early session", async () => {
    verifyOtpMock
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Token is invalid" },
      })
      .mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

    const app = createTestApp();
    const first = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "student@example.com", code: "11111111" });

    expect(first.status).toBe(400);
    expect(first.body.error).toMatch(/invalid or has expired/i);
    expect(first.headers["set-cookie"]).toBeUndefined();

    const second = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "student@example.com", code: "01234567" });

    expect(second.status).toBe(200);
    expect(second.body.authenticated).toBe(true);
    expect(second.headers["set-cookie"]?.some((cookie) => cookie.startsWith("asc_access_token="))).toBe(true);
    expect(verifyOtpMock).toHaveBeenCalledTimes(2);
    expect(verifyOtpMock).toHaveBeenNthCalledWith(1, {
      email: "student@example.com", token: "11111111", type: "signup",
    });
    expect(verifyOtpMock).toHaveBeenNthCalledWith(2, {
      email: "student@example.com", token: "01234567", type: "signup",
    });
  });

  it("does not issue a new session when an already-used verification code is submitted again", async () => {
    verifyOtpMock
      .mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Token has already been used" },
      });

    const app = createTestApp();
    const first = await request(app)
      .post("/api/auth/verify-email")
      .send(validRequest);
    expect(first.status).toBe(200);

    const reused = await request(app)
      .post("/api/auth/verify-email")
      .send(validRequest);
    expect(reused.status).toBe(400);
    expect(reused.body.error).toMatch(/invalid or has expired/i);
    expect(reused.headers["set-cookie"]).toBeUndefined();
    expect(verifyOtpMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an incomplete provider response without setting cookies", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });
    const response = await request(createTestApp())
      .post("/api/auth/verify-email")
      .send(validRequest);

    expect(response.status).toBe(400);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns a controlled server error when the verification provider throws", async () => {
    verifyOtpMock.mockRejectedValue(new Error("provider unavailable"));
    const response = await request(createTestApp())
      .post("/api/auth/verify-email")
      .send(validRequest);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Unexpected server error." });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

// =========================================================
// LOGOUT API AND POST-LOGOUT SESSION TESTS (SCRUM-259)
// =========================================================

describe("POST /api/auth/logout", () => {
  const activeCookies = [
    "asc_access_token=test-access-token",
    "asc_refresh_token=test-refresh-token",
  ];

  function expectCookiesCleared(response) {
    const cookies = response.headers["set-cookie"] || [];
    for (const name of ["asc_access_token", "asc_refresh_token"]) {
      expect(cookies.some((value) =>
        value.startsWith(`${name}=;`) &&
        value.includes("HttpOnly") &&
        /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(value)
      )).toBe(true);
    }
  }

  it("signs out and clears both authentication cookies", async () => {
    setSessionMock.mockResolvedValue({ data: { session: mockSession }, error: null });
    signOutMock.mockResolvedValue({ error: null });

    const response = await request(createTestApp())
      .post("/api/auth/logout")
      .set("Cookie", activeCookies);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Logged out successfully." });
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expectCookiesCleared(response);
  });

  it("clears cookies without calling Supabase when no session exists", async () => {
    const response = await request(createTestApp()).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expectCookiesCleared(response);
  });

  it("clears cookies without attempting sign-out when session restoration fails", async () => {
    setSessionMock.mockResolvedValue({ error: { message: "bad refresh token" } });
    const response = await request(createTestApp())
      .post("/api/auth/logout")
      .set("Cookie", activeCookies);

    expect(response.status).toBe(200);
    expect(signOutMock).not.toHaveBeenCalled();
    expectCookiesCleared(response);
  });

  it("clears cookies even when the Supabase sign-out operation throws", async () => {
    setSessionMock.mockResolvedValue({ error: null });
    signOutMock.mockRejectedValue(new Error("provider unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(createTestApp())
        .post("/api/auth/logout")
        .set("Cookie", activeCookies);
      expect(response.status).toBe(200);
      expectCookiesCleared(response);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("rejects protected requests after the browser applies logout cookie clearing", async () => {
    setSessionMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: mockUser }, error: null });
    const app = createTestApp();
    const agent = request.agent(app);

    // Establish cookies through the public login endpoint.
    signInWithPasswordMock.mockResolvedValue({
      data: { user: mockUser, session: mockSession }, error: null,
    });
    const login = await agent.post("/api/auth/login").send({
      email: mockUser.email,
      password: "Password123!",
    });
    expect(login.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expectCookiesCleared(logout);

    const afterLogout = await agent.get("/api/auth/me");
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body).toEqual({ error: "Authentication required." });
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });
});
