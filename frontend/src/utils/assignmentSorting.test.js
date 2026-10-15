import {
    describe,
    test,
    expect,
} from "vitest";

import { sortAssignments } from "./assignmentSorting";

describe("Assignment Sorting Tests", () => {
    const mockAssignments = [
        {
            id: "1",
            title: "Homework",
            priority: "Low",
            duedate: "2026-10-25",
            status: "Upcoming",
        },
        {
            id: "2",
            title: "Project",
            priority: "High",
            duedate: "2026-10-15",
            status: "In Progress",
        },
        {
            id: "3",
            title: "Exam",
            priority: "Medium",
            duedate: "2026-10-20",
            status: "Completed",
        },
    ];
    
    test("sorts assignments by earliest due date", () => {
        const result = sortAssignments(mockAssignments, "duedate");
        expect(result.map(a => a.id)).toEqual([
            "2", "3", "1"
        ]);
    });

    test("sorts priority from High to Low", () => {
        const result = sortAssignments(mockAssignments, "priority-high");
        expect(result.map(a => a.priority)).toEqual([
            "High", "Medium", "Low"
        ]);
    });

    test("sorts priority from Low to High", () => {
        const result = sortAssignments(mockAssignments, "priority-low");
        expect(result.map(a => a.priority)).toEqual([
            "Low", "Medium", "High"
        ]);
    });

    test("handles an empty assignment list", () => {
        const result = sortAssignments([], "duedate");
        expect(result).toEqual([]);
    });

    test("handles a single assignment", () => {
        const assignments = [
            {
                id: "1",
                priority: "High",
                duedate: "2026-10-20",
            },
        ];

        const result = sortAssignments(assignments, "priority-high");
        expect(result).toEqual(assignments);
    });

    test("handles assignments with equal priorities", () => {
        const assignments = [
            { id: "1", priority: "High" },
            { id: "2", priority: "High" },
            { id: "3", priority: "Low" },
        ];
        const result = sortAssignments(assignments, "priority-high");
        expect(result.map(a => a.id)).toEqual([
            "1", "2", "3"
        ]);
    });

    test("handles assignments with equal due dates", () => {
        const assignments = [
            {id: "1", duedate: "2026-10-20"},
            {id: "2", duedate: "2026-10-20"},
            {id: "3", duedate: "2026-10-15"},
        ];

        const result = sortAssignments(assignments, "duedate");
        expect(result.map(a => a.id)).toEqual([
            "3", "1", "2"
        ]);
    });

    test("sorts overdue assignments by due date", () => {
        const assignments = [
            {
                id: "1",
                duedate: "2026-10-20",
                priority: "Low",
                status: "Upcoming",
            },
            {
                id: "2",
                duedate: "2026-10-10",
                priority: "High",
                status: "Upcoming",
            },
            {
                id: "3",
                duedate: "2026-10-15",
                priority: "Medium",
                status: "In Progress",
            },
        ];

        const result = sortAssignments(assignments, "duedate");
        expect(result.map(a => a.id)).toEqual([
            "2", "3", "1"
        ]);
    });

    test("sort assignments with different statues", () => {
        const result = sortAssignments(mockAssignments, "priority-high");
        expect(result.map(a => a.id)).toEqual([
            "2", "3", "1"
        ]);

        // Sorting should preserve each assignment's status
        expect(result.map(a => a.status)).toEqual([
            "In Progress",
            "Completed",
            "Upcoming",
        ]);
    });

    test("does not modify original assignments", () => {
        const original = structuredClone(mockAssignments);
        sortAssignments(mockAssignments, "priority-high");
        expect(mockAssignments).toEqual(original);
    });

    test("keep original order for unknow sorting option", () => {
        const result = sortAssignments(mockAssignments, "unknown");
        expect(result.map(a => a.id)).toEqual([
            "1", "2", "3"
        ]);
    });
});

