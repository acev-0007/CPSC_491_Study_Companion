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
  signInWithPasswordMock,
  setSessionMock,
  signOutMock,
  getUserMock,
  refreshSessionMock,
} = vi.hoisted(() => ({
  signUpMock: vi.fn(),

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
