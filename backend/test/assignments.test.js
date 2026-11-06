import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import express from "express";
import request from "supertest";

import assignmentRoutes from "../src/routes/assignmentRoutes.js";

let assignments;

const USER_1 = "student-1";
const USER_2 = "student-2";

const ASSIGNMENT_1 =
  "11111111-1111-4111-8111-111111111111";

const OTHER_USER_ASSIGNMENT =
  "22222222-2222-4222-8222-222222222222";

const MISSING_ASSIGNMENT =
  "33333333-3333-4333-8333-333333333333";

function resetStore() {
  assignments = [
    {
      id: ASSIGNMENT_1,
      user_id: USER_1,
      title: "CPSC 491 Assignment",
      course: "CPSC 491",
      duedate: "2026-11-10T12:00:00.000Z",
      estimated_time: "02:00:00",
      priority: "High",
      status: "Upcoming",
      notes: "",
    },
    {
      id: OTHER_USER_ASSIGNMENT,
      user_id: USER_2,
      title: "Private Assignment",
      course: "CPSC 490",
      duedate: "2026-11-12T12:00:00.000Z",
      estimated_time: "03:00:00",
      priority: "Medium",
      status: "Upcoming",
      notes: "Private",
    },
  ];
}

function createFakeSupabase() {
  return {
    from(table) {
      if (table !== "assignments") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const filters = [];
      let operation = "select";
      let payload = null;
      let orderBy = null;

      const matches = (row) =>
        filters.every(
          ([column, value]) => row[column] === value
        );

      const builder = {
        select() {
          return builder;
        },

        eq(column, value) {
          filters.push([column, value]);
          return builder;
        },

        order(column, options = {}) {
          orderBy = {
            column,
            ascending: options.ascending ?? true,
          };

          let data = assignments
            .filter(matches)
            .map((row) => ({ ...row }));

          if (orderBy) {
            data.sort((a, b) => {
              const direction =
                orderBy.ascending ? 1 : -1;

              return a[column] < b[column]
                ? -direction
                : a[column] > b[column]
                  ? direction
                  : 0;
            });
          }

          return Promise.resolve({
            data,
            error: null,
          });
        },

        insert(value) {
          operation = "insert";
          payload = value;

          return {
            select: async () => {
              const row = {
                id:
                  "44444444-4444-4444-8444-444444444444",
                ...payload,
              };

              assignments.push(row);

              return {
                data: [{ ...row }],
                error: null,
              };
            },
          };
        },

        update(value) {
          operation = "update";
          payload = value;
          return builder;
        },

        delete() {
          operation = "delete";
          return builder;
        },

        maybeSingle: async () => {
          if (operation === "select") {
            const row = assignments.find(matches);

            return {
              data: row ? { ...row } : null,
              error: null,
            };
          }

          if (operation === "update") {
            const index =
              assignments.findIndex(matches);

            if (index === -1) {
              return {
                data: null,
                error: null,
              };
            }

            assignments[index] = {
              ...assignments[index],
              ...payload,
            };

            return {
              data: {
                ...assignments[index],
              },
              error: null,
            };
          }

          return {
            data: null,
            error: null,
          };
        },

        then(resolve) {
          if (operation === "update") {
            const updated = [];

            assignments = assignments.map((row) => {
              if (!matches(row)) {
                return row;
              }

              const next = {
                ...row,
                ...payload,
              };

              updated.push(next);
              return next;
            });

            return resolve({
              data: updated,
              error: null,
            });
          }

          if (operation === "delete") {
            const deleted =
              assignments.filter(matches);

            assignments =
              assignments.filter(
                (row) => !matches(row)
              );

            return resolve({
              data: deleted,
              error: null,
            });
          }

          return resolve({
            data: assignments.filter(matches),
            error: null,
          });
        },
      };

      return builder;
    },
  };
}

vi.mock("../src/middleware/requireAuth.js", () => ({
  requireAuth: vi.fn((req, res, next) => {
    const user =
      req.headers["x-test-user"];

    if (!user) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    req.user = {
      id: user,
    };

    req.accessToken = `${user}-token`;

    next();
  }),
}));

vi.mock("../src/config/supabase.js", () => ({
  createUserSupabaseClient:
    vi.fn(() => createFakeSupabase()),
}));

function createApp() {
  const app = express();

  app.use(express.json());

  app.use(
    "/api/assignments",
    assignmentRoutes
  );

  return app;
}

const app = createApp();

const asUser1 = (req) =>
  req.set("x-test-user", USER_1);

const asUser2 = (req) =>
  req.set("x-test-user", USER_2);

describe(
  "Assignment authorization and ownership",
  () => {
    beforeEach(() => {
      resetStore();
    });

    it(
      "rejects unauthenticated assignment access",
      async () => {
        const response =
          await request(app)
            .get("/api/assignments");

        expect(response.status).toBe(401);
      }
    );

    it(
      "returns only assignments owned by the authenticated user",
      async () => {
        const response =
          await asUser1(
            request(app)
              .get("/api/assignments")
          );

        expect(response.status).toBe(200);

        expect(response.body).toHaveLength(1);

        expect(
          response.body[0].id
        ).toBe(ASSIGNMENT_1);

        expect(
          response.body.some(
            (assignment) =>
              assignment.id ===
              OTHER_USER_ASSIGNMENT
          )
        ).toBe(false);
      }
    );

    it(
      "allows a user to retrieve their own assignment",
      async () => {
        const response =
          await asUser1(
            request(app)
              .get(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          );

        expect(response.status).toBe(200);

        expect(
          response.body.id
        ).toBe(ASSIGNMENT_1);
      }
    );

    it(
      "returns 404 when requesting another user's assignment",
      async () => {
        const response =
          await asUser1(
            request(app)
              .get(
                `/api/assignments/${OTHER_USER_ASSIGNMENT}`
              )
          );

        expect(response.status).toBe(404);

        expect(
          response.body.error
        ).toBe("Assignment not found");
      }
    );

    it(
      "returns 404 for a missing assignment",
      async () => {
        const response =
          await asUser1(
            request(app)
              .get(
                `/api/assignments/${MISSING_ASSIGNMENT}`
              )
          );

        expect(response.status).toBe(404);
      }
    );

    it(
      "derives assignment ownership from the authenticated user",
      async () => {
        const response =
          await asUser1(
            request(app)
              .post("/api/assignments")
          ).send({
            title:
              "Security Review",
            course:
              "CPSC 491",
            duedate:
              "2026-11-20T12:00:00",
            estimated_time:
              2,
            priority:
              "High",
            status:
              "Upcoming",

            // Attempt to spoof ownership.
            user_id:
              USER_2,
          });

        expect(response.status).toBe(201);

        expect(
          response.body.user_id
        ).toBe(USER_1);

        const created =
          assignments.find(
            (assignment) =>
              assignment.id ===
              response.body.id
          );

        expect(
          created.user_id
        ).toBe(USER_1);
      }
    );

    it(
      "allows the owner to update assignment status",
      async () => {
        const response =
          await asUser1(
            request(app)
              .patch(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          ).send({
            status:
              "In Progress",
          });

        expect(response.status).toBe(200);

        expect(
          response.body.status
        ).toBe("In Progress");
      }
    );

    it(
      "prevents another user from updating assignment status",
      async () => {
        const response =
          await asUser2(
            request(app)
              .patch(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          ).send({
            status:
              "Completed",
          });

        expect(response.status).toBe(404);

        expect(
          assignments.find(
            (assignment) =>
              assignment.id ===
              ASSIGNMENT_1
          ).status
        ).toBe("Upcoming");
      }
    );

    it(
      "allows the owner to update an assignment",
      async () => {
        const response =
          await asUser1(
            request(app)
              .put(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          ).send({
            title:
              "Updated Assignment",
          });

        expect(response.status).toBe(200);

        expect(
          response.body.title
        ).toBe(
          "Updated Assignment"
        );
      }
    );

    it(
      "prevents another user from updating an assignment",
      async () => {
        const response =
          await asUser2(
            request(app)
              .put(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          ).send({
            title:
              "Stolen Assignment",
          });

        expect(response.status).toBe(404);

        expect(
          assignments.find(
            (assignment) =>
              assignment.id ===
              ASSIGNMENT_1
          ).title
        ).toBe(
          "CPSC 491 Assignment"
        );
      }
    );

    it(
      "allows the owner to delete an assignment",
      async () => {
        const response =
          await asUser1(
            request(app)
              .delete(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          );

        expect(response.status).toBe(200);

        expect(
          assignments.some(
            (assignment) =>
              assignment.id ===
              ASSIGNMENT_1
          )
        ).toBe(false);
      }
    );

    it(
      "prevents another user from deleting an assignment",
      async () => {
        const response =
          await asUser2(
            request(app)
              .delete(
                `/api/assignments/${ASSIGNMENT_1}`
              )
          );

        expect(response.status).toBe(404);

        expect(
          assignments.some(
            (assignment) =>
              assignment.id ===
              ASSIGNMENT_1
          )
        ).toBe(true);
      }
    );
  }
);