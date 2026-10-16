import { afterEach, expect, it, vi } from "vitest";
import { 
    render, 
    screen, 
    cleanup,
    fireEvent,
    waitFor,
} from "@testing-library/react";

import AssignmentTracker from "../pages/AssignmentTracker";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it("renders the Assignment Tracker form", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
            {
                id: "1",
                title: "Assignment",
                course: "CPSC491",
                duedate: "2026-10-20T12:00:00",
                priority: "High",
                status: "Upcoming",
                estimated_time: 2,
            },
        ],
    });
    // Replace global fetch with our mock fetch
    vi.stubGlobal("fetch", mockFetch);

    render(<AssignmentTracker />);

    expect(screen.getByRole("heading", { name: "Assignment Tracker" })).toBeTruthy();
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("Course")).toBeTruthy();
    expect(screen.getByLabelText("Due Date")).toBeTruthy();
    expect(screen.getByLabelText("Estimated Time")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Add Assignment"})).toBeTruthy();
    await waitFor(() => {
        expect(
            screen.getByText("No upcoming assignments")
        ).toBeTruthy();
    });

    expect(
        await screen.findByText("Assignment")
    ).toBeTruthy();
});

it("prevent submitting an assignment with empty required fields", async () => {
    const mockFetch = vi.fn().mockRejectedValue({
        ok: true,
        json: async () => [],
    });
    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);
    
    // Wait for inital assignment retrieval to finish
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled(1);
    });

    // Try submitting an empty form
    const submitButton = screen.getByRole("button", {
        name: "Add Assignment",
    });

    fireEvent.click(submitButton);

    // Check that no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("creates an assignment with valid form data", async () => {
    const mockFetch = vi.fn()
        .mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: "1",
                title: "Assignment",
            }),
        })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        });
    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);
    
    // Fill out the required field
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Assignment" },
    });

    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00:00" },
    });

    fireEvent.change(screen.getByLabelText("Estimated Time"), {
        target: { value: "2" },
    });

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", { name: "Add Assignment" })
    );

    // Verify that the POST request was sent
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:3001/api/assignments",
            expect.objectContaining({
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: expect.any(String),
            })
        );
    });

    // Verify the assignment data
    const postCall = mockFetch.mock.calls.find(
        ([, options]) => options?.method === "POST"
    );
    const submittedData = JSON.parse(postCall[1].body);
    expect(submittedData.title).toBe("Assignment");
    expect(submittedData.course).toBe("CPSC491");
    expect(submittedData.priority).toBe("Low");
    expect(submittedData.status).toBe("Upcoming");
    expect(submittedData.estimated_time).toBe("2");

    // Verify success message
    expect(
        await screen.findByText("Assignment created successfully!")
    ).toBeTruthy();
});

it("retrieves and displays assignments from the API", async () => {
    const mockAssignments = [
        {
        id: "1",
        title: "Assignment",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Upcoming",
        estimated_time: 2,
        },
        {
        id: "2",
        title: "Project",
        course: "CPSC490",
        duedate: "2026-10-25T12:00:00",
        priority: "Medium",
        status: "In Progress",
        estimated_time: 4,
        },
        {
        id: "3",
        title: "English Essay",
        course: "ENGL101",
        duedate: "2026-10-15T12:00:00",
        priority: "Low",
        status: "Completed",
        estimated_time: 3,
        },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAssignments,
    });

    vi.stubGlobal("fetch", mockFetch);

    render(<AssignmentTracker />);

    // Wait for the assignments to appear
    expect(await screen.findByText("Assignment")).toBeTruthy();
    expect(await screen.findByText("Project")).toBeTruthy();
    expect(await screen.findByText("English Essay")).toBeTruthy();

    // Verify the GET request
    expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/assignments",
        expect.objectContaining({
        credentials: "include",
        })
    );

    // Verify the assignments are displayed
    expect(screen.getByText("Assignment")).toBeTruthy();
    expect(screen.getByText("Project")).toBeTruthy();
    expect(screen.getByText("English Essay")).toBeTruthy();
});

it("updates assignment status successfully", async () => {
    const originalAssignment = {
        id: "1",
        title: "Assignment",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Upcoming",
        estimated_time: 2,
    };

    const updatedAssignment = {
        ...originalAssignment,
        status: "In Progress",
    };

    // Mock the API 
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "PATCH") {
        return Promise.resolve({
            ok: true,
            json: async () => updatedAssignment,
        });
        }

        return Promise.resolve({
        ok: true,
        json: async () => [originalAssignment],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    render(<AssignmentTracker />);

    // Wait for the assignment to load
    const assignmentTitle = await screen.findByText("Assignment");

    // Find the assignment card
    const assignmentCard = assignmentTitle.closest(".assignment-card");

    // Find the status dropdown inside that card
    const statusDropdown = assignmentCard.querySelector("select");

    // Change status from Upcoming to In Progress
    fireEvent.change(statusDropdown, {
        target: { value: "In Progress" },
    });

    // Verify that the PATCH request was sent
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/assignments/1",
        expect.objectContaining({
            method: "PATCH",
            credentials: "include",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify({
            status: "In Progress",
            }),
        })
        );
    });

    // Verify that the assignment status updated in the UI
    await waitFor(() => {
        const updatedAssignmentTitle = screen.getByText("Assignment");
        const updatedAssignmentCard = updatedAssignmentTitle.closest(".assignment-card");
        const updatedstatusDropdown = updatedAssignmentCard.querySelector("select");
        expect(updatedstatusDropdown.value).toBe("In Progress");
    });
    });

    // Simulates an HTTP 500 error (server-side failure)
    it("displays an error message when assignment retrieval fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
    });

    vi.stubGlobal("fetch", mockFetch);

    // Suppress the expected console error during this test
    const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

    try {
        render(<AssignmentTracker />);

        // Verify the error message appears
        expect(
        await screen.findByText("Failed to fetch assignments")
        ).toBeTruthy();

        // Verify the API request was attempted
        expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/assignments",
        expect.objectContaining({
            credentials: "include",
        })
        );
    } finally {
        consoleSpy.mockRestore();
    }
});

it("displays an error message when assignment creation fails", async () => {
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "POST") {
        return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => "Internal Server Error",
        });
        }

        return Promise.resolve({
        ok: true,
        json: async () => [],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Suppress expected console errors
    const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

    try {
        render(<AssignmentTracker />);

        // Wait for the initial GET request
        await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:3001/api/assignments",
            expect.objectContaining({
            credentials: "include",
            })
        );
        });

        // Fill in required fields
        fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Assignment" },
        });

        fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC491" },
        });

        fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
        });

        fireEvent.change(screen.getByLabelText("Estimated Time"), {
        target: { value: "2" },
        });

        // Submit the form
        fireEvent.click(
        screen.getByRole("button", { name: "Add Assignment" })
        );

        // Verify the error message appears
        expect(
        await screen.findByText(
            "Failed to create assignment: 500 Internal Server Error"
        )
        ).toBeTruthy();

        // Verify a POST request was attempted
        expect(
        mockFetch.mock.calls.some(
            ([, options]) => options?.method === "POST"
        )
        ).toBe(true);

        // Verify no success message appears
        expect(
        screen.queryByText("Assignment created successfully!")
        ).toBeNull();
    } finally {
        consoleSpy.mockRestore();
    }
});