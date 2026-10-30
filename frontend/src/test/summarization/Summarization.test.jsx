
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Summarization from "../../pages/Summarization";
import { getAiReadyDocumentContent } from "../../api/documents";
import { MemoryRouter, useNavigate } from "react-router-dom";

vi.mock("../../api/documents", () => ({
  getAiReadyDocumentContent: vi.fn(),
}));

describe("SCRUM-230 Document Summarization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads uploaded document text into the summarization page", async () => {
    getAiReadyDocumentContent.mockResolvedValue({
      documentId: "123",
      name: "lecture-notes.txt",
      status: "ready",
      text: "Binary search divides a sorted array in half.",
      chunks: [],
    });

    render(
      <MemoryRouter
        initialEntries={["/summarization?documentId=123"]}
      >
        <Summarization />
      </MemoryRouter>
    );

    expect(
      await screen.findByDisplayValue(
        "Binary search divides a sorted array in half."
      )
    ).toBeTruthy();

    expect(
      getAiReadyDocumentContent
    ).toHaveBeenCalledWith("123");

    expect(
      screen.getByText(/Loaded document: lecture-notes.txt/i)
    ).toBeTruthy();
  });

  it("sends uploaded document text to the AI summarization endpoint", async () => {
    const documentText =
      "Binary search divides a sorted array in half.";

    getAiReadyDocumentContent.mockResolvedValue({
      documentId: "123",
      name: "lecture-notes.txt",
      status: "ready",
      text: documentText,
      chunks: [],
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({
          summary: "Binary search is an efficient search algorithm.",
        }),
      });

    try {
      render(
        <MemoryRouter
          initialEntries={["/summarization?documentId=123"]}
        >
          <Summarization />
        </MemoryRouter>
      );

      await screen.findByDisplayValue(documentText);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Generate Summary",
        })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/ai/summarize",
          expect.objectContaining({
            method: "POST",
            credentials: "same-origin",
            body: JSON.stringify({
              notes: documentText,
            }),
          })
        );
      });

      expect(
        await screen.findByText(
          "Binary search is an efficient search algorithm."
        )
      ).toBeTruthy();
    } finally {
      fetchMock.mockRestore();
    }
  });

  // SCRUM-230: Missing or unauthorized document
  it("shows an error when a document is not found", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Document not found.")
    );

    render(
      <MemoryRouter
        initialEntries={["/summarization?documentId=missing"]}
      >
        <Summarization />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Document not found.");

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();
  });

  // SCRUM-230: Document still processing
  it("shows an error when a document is still processing", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Document is still processing.")
    );

    render(
      <MemoryRouter
        initialEntries={["/summarization?documentId=processing"]}
      >
        <Summarization />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Document is still processing.");

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();
  });

  it("clears uploaded document text when switching to manual input", async () => {
    getAiReadyDocumentContent.mockResolvedValue({
      documentId: "123",
      name: "lecture-notes.txt",
      status: "ready",
      text: "Binary search divides a sorted array in half.",
      chunks: [],
    });

    function SwitchToManual() {
      const navigate = useNavigate();

      return (
        <button onClick={() => navigate("/summarization")}>
          Switch to manual
        </button>
      );
    }

    render(
      <MemoryRouter
        initialEntries={["/summarization?documentId=123"]}
      >
        <SwitchToManual />
        <Summarization />
      </MemoryRouter>
    );

    await screen.findByDisplayValue(
      "Binary search divides a sorted array in half."
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Switch to manual",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          "Paste your notes or study material here..."
        )
      ).toHaveValue("");
    });
  });

});
