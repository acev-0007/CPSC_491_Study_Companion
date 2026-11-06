import "dotenv/config";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import aiRoutes from "../src/routes/aiRoutes.js";

// SCRUM-125 (AIQ-08): LIVE check of POST /api/ai/quiz against the real Claude
// API. Skipped unless explicitly enabled, so CI and normal `npm test` runs make
// no billable request:
//
//   RUN_LIVE_AI_TESTS=1 npx vitest run test/quizRoutes.live.test.js
//
// Needs ANTHROPIC_API_KEY and ANTHROPIC_MODEL in backend/.env. Auth is not part
// of this test (covered in quizRoutes.test.js); it mounts the real route only.

const live = process.env.RUN_LIVE_AI_TESTS === "1";

const NOTES = `
A process is a program in execution. The operating system's scheduler decides
which ready process runs on the CPU. A context switch saves the state of the
running process and restores the state of the next one. A mutex lets only one
thread enter a critical section at a time. Deadlock requires four conditions:
mutual exclusion, hold and wait, no preemption, and circular wait. Virtual
memory lets a process use more memory than is physically installed by paging
pages between RAM and disk.
`;

describe.skipIf(!live)("live Claude: POST /api/ai/quiz", () => {
  it("returns a valid 5-question quiz", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/ai", aiRoutes);

    const response = await request(app)
      .post("/api/ai/quiz")
      .send({ notes: NOTES });

    expect(response.status).toBe(200);
    expect(response.body.questions).toHaveLength(5);

    for (const q of response.body.questions) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
    }

    console.log(JSON.stringify(response.body, null, 2));
  }, 60000);
});