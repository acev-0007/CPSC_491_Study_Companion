
import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";

// Real Express application
const app = createApp();

const API = "/api/assignments";

// Enable integration tests locally or in GitHub Actions.
const enabled =
  process.env.RUN_SUPABASE_INTEGRATION === "true" ||
  process.env.GITHUB_ACTIONS === "true";

const testSuite = enabled ? describe : describe.skip;

testSuite("Assignment Tracker Workflow Integration", () => {
  it("creates, retrieves, updates, and deletes an assignment", async () => {
    const email =
        process.env.SUPABASE_TEST_USER1_EMAIL ||
        process.env.E2E_TEST_EMAIL;

    const password =
        process.env.SUPABASE_TEST_USER1_PASSWORD ||
        process.env.E2E_TEST_PASSWORD;

    if (!email || !password) {
      throw new Error("Dedicated test account credentials are required.");
    }

    const agent = request.agent(app);
    let assignmentId = null;

    try {
      // 1. Log in using the dedicated test account.
      const login = await agent
        .post("/api/auth/login")
        .send({ email, password });

      expect(login.status).toBe(200);

      // 2. Create a disposable assignment.
      const assignment = {
        title: `E2E-Test-${randomUUID()}`,
        course: "CPSC491",
        duedate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        estimated_time: 2,
        priority: "High",
        status: "Upcoming",
        notes: "Automated workflow integration test",
      };

      const created = await agent
        .post(API)
        .send(assignment);

      // Save the ID before assertions so cleanup can run.
      assignmentId = created.body?.id ?? null;

      expect(created.status).toBe(201);
      expect(assignmentId).toBeTruthy();

      // 3. Retrieve and verify saved information.
      const retrieved = await agent
        .get(`${API}/${assignmentId}`);

      expect(retrieved.status).toBe(200);
      expect(retrieved.body.title).toBe(assignment.title);
      expect(retrieved.body.priority).toBe("High");
      expect(retrieved.body.status).toBe("Upcoming");
      expect(
        new Date(retrieved.body.duedate).toISOString()
      ).toBe(assignment.duedate);

      // 4. Update assignment status.
      const updated = await agent
        .patch(`${API}/${assignmentId}`)
        .send({ status: "In Progress" });

      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe("In Progress");

      // 5. Retrieve again to verify persistence.
      const persisted = await agent
        .get(`${API}/${assignmentId}`);

      expect(persisted.status).toBe(200);
      expect(persisted.body.status).toBe("In Progress");

      // 6. Delete the test assignment.
      const deleted = await agent
        .delete(`${API}/${assignmentId}`);

      expect(deleted.status).toBe(200);

      // 7. Confirm deletion.
      const missing = await agent
        .get(`${API}/${assignmentId}`);

      expect(missing.status).toBe(404);

      assignmentId = null;

    } finally {
      // Clean up only the assignment created by this test.
      if (assignmentId) {
        const cleanup = await agent
          .delete(`${API}/${assignmentId}`);

        if (cleanup.status !== 200 && cleanup.status !== 404) {
          console.error(
            `Test cleanup failed for assignment ${assignmentId}:`,
            cleanup.status
          );
        }
      }
    }
  });
});
