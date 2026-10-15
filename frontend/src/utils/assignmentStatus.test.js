import {
    describe,
    test,
    expect,
    vi,
    beforeEach,
    afterEach,
} from "vitest";

import {
    isOverdue,
    isDueSoon,
    getDeadlineStatus,
} from "./assignmentStatus";

describe("Assignment Status and Deadline Tests", () => {
    beforeEach(() => {
        // Set a fixed date for consistent testing
        vi.useFakeTimers();
        vi.setSystemTime(
            new Date("2026-10-14T12:00:00Z")
        );
    });

    afterEach(() => {
    // Restore the actual system clock
        vi.useRealTimers();
    });

    test("identifies an overdue assignment", () => {
        const assignment = {
            duedate: "2026-10-13T12:00:00Z",
            status: "Upcoming",
        };
        expect(isOverdue(assignment)).toBe(true);
    });

    test("does not mark future assignments overdue", () => {
        const assignment = {
            duedate: "2026-10-20T12:00:00Z",
            status: "Upcoming",
        };
        expect(isOverdue(assignment)).toBe(false);
    });

    test("identifies an assignment is due within 3 days", () => {
        const assignment = {
            duedate: "2026-10-16T12:00:00Z",
            status: "Upcoming",
        };
        expect(isDueSoon(assignment)).toBe(true);
    });

    test("does not mark assignment beyond 3 days as due soon", () => {
        const assignment = {
            duedate: "2026-10-20T12:00:00Z",
            status: "Upcoming",
        };
        expect(isDueSoon(assignment)).toBe(false);
    });

    test("does not mark completed assignments overdue", () => {
        const assignment = {
            duedate: "2026-10-13T12:00:00Z",
            status: "Completed",
        };
        expect(isOverdue(assignment)).toBe(false);
        expect(getDeadlineStatus(assignment)).toBe("completed");
    });

    test("does not mark completed assignments due soon", () => {
        const assignment = {
            duedate: "2026-10-16T12:00:00Z",
            status: "Completed",
        };
        expect(isDueSoon(assignment)).toBe(false);
        expect(getDeadlineStatus(assignment)).toBe("completed");
    });

    test("return overdue for past incomplete assignments", () => {
        const assignment = {
            duedate: "2026-10-13T12:00:00Z",
            status: "In Progress",
        };
        expect(getDeadlineStatus(assignment)).toBe("overdue");
    });

    test("return due-soon for upcoming assignments", () => {
        const assignment = {
            duedate: "2026-10-16T12:00:00Z",
            status: "Upcoming",
        };
        expect(getDeadlineStatus(assignment)).toBe("due-soon");
    });

    test("return normal for assignments due later", () => {
        const assignment = {
            duedate: "2026-10-20T12:00:00Z",
            status: "Upcoming",
        };
        expect(getDeadlineStatus(assignment)).toBe("normal");
    });

    test("treats an assignment due exactly now as due soon", () => {
        const assignment = {
            duedate: "2026-10-14T12:00:00Z",
            status: "Upcoming",
        };
        expect(isOverdue(assignment)).toBe(false);
        expect(isDueSoon(assignment)).toBe(true);
    });

    test("includes an assignment due exactly 3 days from now", () => {
        const assignment = {
            duedate: "2026-10-17T12:00:00Z",
            status: "Upcoming",
        };
        expect(isDueSoon(assignment)).toBe(true);
    });

    test("excludes anassignment due just beyond 3 days", () => {
        const assignment = {
            duedate: "2026-10-17T12:00:01Z",
            status: "Upcoming",
        };
        expect(isDueSoon(assignment)).toBe(false);
    });

    test("does not mark overdue assignments as due soon", () => {
        const assignment = {
            duedate: "2026-10-13T12:00:00Z",
            status: "Upcoming",
        };
        expect(isDueSoon(assignment)).toBe(false);
        expect(getDeadlineStatus(assignment)).toBe("overdue");
    })
});


