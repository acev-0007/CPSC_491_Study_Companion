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

it("displays an error when assignment status update fails", async () => {
  const mockAssignment = {
    id: "1",
    title: "Homework 1",
    course: "CPSC491",
    duedate: "2026-11-20T12:00:00",
    priority: "High",
    status: "Upcoming",
    estimated_time: 2,
  };

  const mockFetch = vi.fn().mockImplementation((url, options) => {
    if (options?.method === "PATCH") {
      return Promise.resolve({
        ok: false,
        status: 500,
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => [mockAssignment],
    });
  });

  vi.stubGlobal("fetch", mockFetch);

  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  try {
    render(<AssignmentTracker />);

    const assignmentTitle = await screen.findByText("Homework 1");

    const assignmentCard = assignmentTitle.closest(".assignment-card");

    const statusDropdown = assignmentCard.querySelector("select");

    fireEvent.change(statusDropdown, {
      target: { value: "In Progress" },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/assignments/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            status: "In Progress",
          }),
        })
      );
    });

    expect(
      await screen.findByText("Failed to update assignment status")
    ).toBeTruthy();

    // Status should remain unchanged after the failed request.
    expect(statusDropdown.value).toBe("Upcoming");

    // Find the Upcoming section
    const upcomingSection = screen
        .getByRole("heading", { name: "Upcoming" })
        .closest(".assignment-section");

    // Find the In Progress section
    const inProgressSection = screen
        .getByRole("heading", { name: "In Progress" })
        .closest(".assignment-section");

    // Verify assignment remains in Upcoming
    expect(
        upcomingSection.querySelector(".assignment-card h3")?.textContent
    ).toBe("Homework 1");

    // Verify assignment did not move to In Progress
    expect(
        inProgressSection.querySelectorAll(".assignment-card")
    ).toHaveLength(0);

  } finally {
    consoleSpy.mockRestore();
  }
});

it("prevents creating an assignment with whitespace-only fields for title", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
    });

    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Enter whitespace-only title
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "     " },
    });

    // Enter whitespace-only course
    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC 491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
    });

    fireEvent.change(screen.getByLabelText("Estimated Time"), {
        target: { value: "2" },
    });

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("prevents creating an assignment with whitespace-only fields for Course", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
    });

    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Enter whitespace-only title
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Math Assignment" },
    });

    // Enter whitespace-only course
    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "    " },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
    });

    fireEvent.change(screen.getByLabelText("Estimated Time"), {
        target: { value: "2" },
    });

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("prevents creating an assignment with empty Estimated Time", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
    });

    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fill in valid required fields
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Math Assignment" },
    });

    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC 491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
    });

    // Enter empty Estimated Time
    const estimatedTimeInput = screen.getByLabelText("Estimated Time");

    fireEvent.change(estimatedTimeInput, {
        target: { value: "" },
    });

    // Verify Estimated Time is invalid
    expect(estimatedTimeInput.value).toBe("");
    expect(estimatedTimeInput.checkValidity()).toBe(false);

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("prevents creating an assignment with zero Estimated Time", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
    });

    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fill in valid required fields
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Math Assignment" },
    });

    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC 491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
    });

    // Enter zero Estimated Time
    const estimatedTimeInput = screen.getByLabelText("Estimated Time");

    fireEvent.change(estimatedTimeInput, {
        target: { value: "0" },
    });

    // Verify Estimated Time is invalid
    expect(estimatedTimeInput.value).toBe("0");
    expect(estimatedTimeInput.checkValidity()).toBe(false);

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("prevents creating an assignment with negative Estimated Time", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
    });

    vi.stubGlobal("fetch", mockFetch);
    render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fill in valid required fields
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Math Assignment" },
    });

    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC 491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-10-20T12:00" },
    });

    // Enter negative Estimated Time
    const estimatedTimeInput = screen.getByLabelText("Estimated Time");

    fireEvent.change(estimatedTimeInput, {
        target: { value: "-5" },
    });

    // Verify Estimated Time is invalid
    expect(estimatedTimeInput.value).toBe("-5");
    expect(estimatedTimeInput.checkValidity()).toBe(false);

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify no POST request was sent
    const postRequests = mockFetch.mock.calls.filter(
        ([, options]) => options?.method === "POST"
    );

    expect(postRequests).toHaveLength(0);
});

it("updates assignment status In Progress -> Completed", async () => {
    const originalAssignment = {
        id: "1",
        title: "Assignment",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "In Progress",
        estimated_time: 2,
    };

    const updatedAssignment = {
        ...originalAssignment,
        status: "Completed",
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

    // Find the status dropdown
    const statusDropdown = assignmentCard.querySelector("select");

    // Change status from In Progress to Completed
    fireEvent.change(statusDropdown, {
        target: { value: "Completed" },
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
                    status: "Completed",
                }),
            })
        );
    });

    // Verify that the assignment status updated in the UI
    await waitFor(() => {
        const updatedAssignmentTitle = screen.getByText("Assignment");
        const updatedAssignmentCard = updatedAssignmentTitle.closest(".assignment-card");
        const updatedStatusDropdown = updatedAssignmentCard.querySelector("select");

        expect(updatedStatusDropdown.value).toBe("Completed");
    });

    // Find the Completed section
    const completedSection = screen
        .getByRole("heading", { name: "Completed" })
        .closest(".assignment-section");

    // Find the In Progress section
    const inProgressSection = screen
        .getByRole("heading", { name: "In Progress" })
        .closest(".assignment-section");

    // Verify assignment moved to Completed
    expect(
        completedSection.querySelector(".assignment-card h3")?.textContent
    ).toBe("Assignment");

    // Verify assignment is no longer in In Progress
    expect(
        inProgressSection.querySelectorAll(".assignment-card")
    ).toHaveLength(0);
});

it("updates assignment status Completed -> Upcoming", async () => {
    const originalAssignment = {
        id: "1",
        title: "Assignment",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Completed",
        estimated_time: 2,
    };

    const updatedAssignment = {
        ...originalAssignment,
        status: "Upcoming",
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

    // Find the status dropdown
    const statusDropdown = assignmentCard.querySelector("select");

    // Change status from Completed to Upcoming
    fireEvent.change(statusDropdown, {
        target: { value: "Upcoming" },
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
                    status: "Upcoming",
                }),
            })
        );
    });

    // Verify that the assignment status updated in the UI
    await waitFor(() => {
        const updatedAssignmentTitle = screen.getByText("Assignment");
        const updatedAssignmentCard = updatedAssignmentTitle.closest(".assignment-card");
        const updatedStatusDropdown = updatedAssignmentCard.querySelector("select");

        expect(updatedStatusDropdown.value).toBe("Upcoming");
    });

    // Find the Upcoming section
    const upcomingSection = screen
        .getByRole("heading", { name: "Upcoming" })
        .closest(".assignment-section");

    // Find the Completed section
    const completedSection = screen
        .getByRole("heading", { name: "Completed" })
        .closest(".assignment-section");

    // Verify assignment is no longer in Completed
    expect(
        completedSection.querySelectorAll(".assignment-card")
    ).toHaveLength(0);

    // Verify assignment moved to Upcoming
    expect(
        upcomingSection.querySelector(".assignment-card h3")?.textContent
    ).toBe("Assignment");
});

it("deletes an assignment successfully", async () => {
    const originalAssignment = {
        id: "1",
        title: "Homework 1",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Upcoming",
        estimated_time: 2,
    };

    // Mock the API
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "DELETE") {
            return Promise.resolve({
                ok: true,
            });
        }

        return Promise.resolve({
            ok: true,
            json: async () => [originalAssignment],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Mock the confirmation dialog to simulate clicking OK
    const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);

    try {
        render(<AssignmentTracker />);

        // Wait for the assignment to load
        const assignmentTitle = await screen.findByText("Homework 1");
        expect(assignmentTitle).toBeTruthy();

        // Find the delete button
        const deleteButton = screen.getByRole("button", {
            name: "Delete Homework 1",
        });

        // Click the delete button
        fireEvent.click(deleteButton);

        // Verify the confirmation dialog appeared
        expect(confirmSpy).toHaveBeenCalledWith(
            "Are you sure you want to delete this assignment?"
        );

        // Verify that the DELETE request was sent
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3001/api/assignments/1",
                expect.objectContaining({
                    method: "DELETE",
                    credentials: "include",
                })
            );
        });

        // Verify the assignment has been removed
        await waitFor(() => {
            expect(screen.queryByText("Homework 1")).toBeNull();
        });

        // Verify success message
        expect(
            screen.getByText("Assignment deleted successfully")
        ).toBeTruthy();

    } finally {
        // Restore the original confirmation dialog
        confirmSpy.mockRestore();
    }
});

it("cancel deleting an assignment", async () => {
    const originalAssignment = {
        id: "1",
        title: "Homework 1",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Upcoming",
        estimated_time: 2,
    };

    // Mock the API
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "DELETE") {
            return Promise.resolve({
                ok: true,
            });
        }

        return Promise.resolve({
            ok: true,
            json: async () => [originalAssignment],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Mock the confirmation dialog to simulate clicking cancel
    const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(false);

    try {
        render(<AssignmentTracker />);

        // Wait for the assignment to load
        const assignmentTitle = await screen.findByText("Homework 1");
        expect(assignmentTitle).toBeTruthy();

        // Find the delete button
        const deleteButton = screen.getByRole("button", {
            name: "Delete Homework 1",
        });

        // Click the delete button
        fireEvent.click(deleteButton);

        // Verify the confirmation dialog appeared
        expect(confirmSpy).toHaveBeenCalledWith(
            "Are you sure you want to delete this assignment?"
        );

        // Verify no DELETE request was sent
        const deleteRequests = mockFetch.mock.calls.filter(
            ([, options]) => options?.method === "DELETE"
        );

        expect(deleteRequests).toHaveLength(0);

        expect(screen.getByText("Homework 1")).toBeTruthy();

        // Verify no message has been sent
        expect(
            screen.queryByText("Assignment deleted successfully")
        ).toBeNull();

    } finally {
        // Restore the original confirmation dialog
        confirmSpy.mockRestore();
    }
});

it("failed assignment deletion", async () => {
    const originalAssignment = {
        id: "1",
        title: "Homework 1",
        course: "CPSC491",
        duedate: "2026-10-20T12:00:00",
        priority: "High",
        status: "Upcoming",
        estimated_time: 2,
    };

    // Mock the API
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "DELETE") {
            return Promise.resolve({
                ok: false,
                status: 500,
            });
        }

        return Promise.resolve({
            ok: true,
            json: async () => [originalAssignment],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Mock the confirmation dialog to simulate clicking OK
    const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);

    const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

    try {
        render(<AssignmentTracker />);

        // Wait for the assignment to load
        const assignmentTitle = await screen.findByText("Homework 1");
        expect(assignmentTitle).toBeTruthy();

        // Find the delete button
        const deleteButton = screen.getByRole("button", {
            name: "Delete Homework 1",
        });

        // Click the delete button
        fireEvent.click(deleteButton);

        // Verify the confirmation dialog appeared
        expect(confirmSpy).toHaveBeenCalledWith(
            "Are you sure you want to delete this assignment?"
        );

        // Verify that the DELETE request was sent
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3001/api/assignments/1",
                expect.objectContaining({
                    method: "DELETE",
                    credentials: "include",
                })
            );
        });

        // Verify the error message appears
        expect(
            await screen.findByText("Failed to delete assignment")
        ).toBeTruthy();

        // Verify the assignment still exists
        expect(screen.getByText("Homework 1")).toBeTruthy();

        // Verify no success message appears
        expect(
            screen.queryByText("Assignment deleted successfully")
        ).toBeNull();

    } finally {
        // Restore the original confirmation dialog
        confirmSpy.mockRestore();
        consoleSpy.mockRestore();
    }
});

it("persists a newly created assignment after reloading", async () => {
    // Simulate assignments stored in the backend
    let savedAssignments = [];

    const mockFetch = vi.fn().mockImplementation((url, options) => {
        // Handle POST request
        if (options?.method === "POST") {
            const assignmentData = JSON.parse(options.body);

            const newAssignment = {
                ...assignmentData,
                id: "1",
            };

            savedAssignments.push(newAssignment);

            return Promise.resolve({
                ok: true,
                json: async () => newAssignment,
            });
        }

        // Handle GET request
        return Promise.resolve({
            ok: true,
            json: async () => [...savedAssignments],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    const { unmount } = render(<AssignmentTracker />);

    // Wait for initial assignment retrieval
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fill out the required fields
    fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Math Assignment" },
    });

    fireEvent.change(screen.getByLabelText("Course"), {
        target: { value: "CPSC491" },
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
        target: { value: "2026-11-20T12:00" },
    });

    fireEvent.change(screen.getByLabelText("Estimated Time"), {
        target: { value: "2" },
    });

    // Submit the form
    fireEvent.click(
        screen.getByRole("button", {
            name: "Add Assignment",
        })
    );

    // Verify POST request was sent
    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:3001/api/assignments",
            expect.objectContaining({
                method: "POST",
                credentials: "include",
            })
        );
    });

    // Verify assignment appears after creation
    expect(
        await screen.findByText("Math Assignment")
    ).toBeTruthy();

    // Unmount component to simulate leaving the page
    unmount();

    // Render component again to simulate reloading
    render(<AssignmentTracker />);

    // Verify the assignment still appears after reloading
    expect(
        await screen.findByText("Math Assignment")
    ).toBeTruthy();

    // Verify the assignment was retrieved from the API again
    const getRequests = mockFetch.mock.calls.filter(
        ([, options]) => !options?.method || options.method === "GET"
    );

    expect(getRequests).toHaveLength(3);
});

it("persists the assignment status after reloading", async () => {
    // Simulate assignments stored in the backend
    let savedAssignments = [
        {
            id: "1",
            title: "Homework 1",
            course: "CPSC491",
            duedate: "2026-11-20T12:00",
            priority: "High",
            status: "Upcoming",
            estimated_time: 2,
        },
    ];

    // Mock the API
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "PATCH") {
            const updatedData = JSON.parse(options.body);

            // Update the assignment in mock storage
            savedAssignments = savedAssignments.map((assignment) =>
                assignment.id === "1"
                    ? { ...assignment, ...updatedData }
                    : assignment
            );

            return Promise.resolve({
                ok: true,
                json: async () => savedAssignments[0],
            });
        }

        // Handle GET request
        return Promise.resolve({
            ok: true,
            json: async () => [...savedAssignments],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    const { unmount } = render(<AssignmentTracker />);

    // Wait for the assignment to load
    const assignmentTitle = await screen.findByText("Homework 1");

    // Find the assignment card
    const assignmentCard = assignmentTitle.closest(".assignment-card");

    // Find the status dropdown
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

    // Verify that the assignment moved to In Progress
    await waitFor(() => {
        const inProgressSection = screen
            .getByRole("heading", { name: "In Progress" })
            .closest(".assignment-section");

        expect(
            inProgressSection.querySelector(".assignment-card h3")?.textContent
        ).toBe("Homework 1");
    });

    // Unmount component to simulate leaving the page
    unmount();

    // Render component again to simulate reloading
    render(<AssignmentTracker />);

    // Wait for the assignment to load again
    const reloadedAssignment = await screen.findByText("Homework 1");

    // Find the reloaded assignment card
    const reloadedCard = reloadedAssignment.closest(".assignment-card");

    // Verify the updated status persisted
    expect(
        reloadedCard.querySelector("select").value
    ).toBe("In Progress");

    // Verify assignment remains in In Progress section
    const inProgressSection = screen
        .getByRole("heading", { name: "In Progress" })
        .closest(".assignment-section");

    expect(
        inProgressSection.querySelector(".assignment-card h3")?.textContent
    ).toBe("Homework 1");

    // Verify GET requests occurred before and after reloading
    const getRequests = mockFetch.mock.calls.filter(
        ([, options]) => !options?.method || options.method === "GET"
    );

    expect(getRequests).toHaveLength(2);
});

it("persists the assignment deletion after reloading", async () => {
    // Simulate assignments stored in the backend
    let savedAssignments = [
        {
            id: "1",
            title: "Homework 1",
            course: "CPSC491",
            duedate: "2026-11-20T12:00",
            priority: "High",
            status: "Upcoming",
            estimated_time: 2,
        },
    ];

    // Mock the API
    const mockFetch = vi.fn().mockImplementation((url, options) => {
        if (options?.method === "DELETE") {
            savedAssignments = savedAssignments.filter(
                (assignment) => assignment.id !== "1"
            );

            return Promise.resolve({
                ok: true,
            });
        }

        // Handle GET requests
        return Promise.resolve({
            ok: true,
            json: async () => [...savedAssignments],
        });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Mock confirmation dialog to simulate clicking OK
    const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockReturnValue(true);

    try {
        const { unmount } = render(<AssignmentTracker />);

        // Wait for the assignment to load
        const assignmentTitle = await screen.findByText("Homework 1");
        expect(assignmentTitle).toBeTruthy();

        // Find the delete button
        const deleteButton = screen.getByRole("button", {
            name: "Delete Homework 1",
        });

        // Click the delete button
        fireEvent.click(deleteButton);

        // Verify confirmation dialog appeared
        expect(confirmSpy).toHaveBeenCalledWith(
            "Are you sure you want to delete this assignment?"
        );

        // Verify DELETE request was sent
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3001/api/assignments/1",
                expect.objectContaining({
                    method: "DELETE",
                    credentials: "include",
                })
            );
        });

        // Verify assignment disappears after deletion
        await waitFor(() => {
            expect(screen.queryByText("Homework 1")).toBeNull();
        });

        // Verify assignment was removed from mock storage
        expect(savedAssignments).toHaveLength(0);

        // Unmount component to simulate leaving the page
        unmount();

        // Render component again to simulate reloading
        render(<AssignmentTracker />);

        // Verify another GET request was made
        await waitFor(() => {
            const getRequests = mockFetch.mock.calls.filter(
                ([, options]) =>
                    !options?.method || options.method === "GET"
            );

            expect(getRequests).toHaveLength(2);
        });

        // Verify the deleted assignment does not reappear
        expect(screen.queryByText("Homework 1")).toBeNull();

        // Verify Upcoming section is empty
        expect(
            await screen.findByText("No upcoming assignments")
        ).toBeTruthy();

    } finally {
        // Restore the original confirmation dialog
        confirmSpy.mockRestore();
    }
});
