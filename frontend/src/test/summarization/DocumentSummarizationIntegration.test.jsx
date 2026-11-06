
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Summarization from "../../pages/Summarization";
import { getAiReadyDocumentContent } from "../../api/documents";

vi.mock("../../api/documents", () => ({
  getAiReadyDocumentContent: vi.fn(),
}));

const documentText =
  "Binary search repeatedly divides a sorted array in half.";

function renderDocument(documentId = "doc-123") {
  return render(
    <MemoryRouter
      initialEntries={[`/summarization?documentId=${documentId}`]}
    >
      <Summarization />
    </MemoryRouter>
  );
}

function mockReadyDocument() {
  getAiReadyDocumentContent.mockResolvedValue({
    documentId: "doc-123",
    name: "lecture-notes.txt",
    status: "ready",
    text: documentText,
    chunks: [],
  });
}

function mockJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => body,
  };
}

describe("SCRUM-244 Document-to-Summarization Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a document with empty extracted text", async () => {
    getAiReadyDocumentContent.mockResolvedValue({
      documentId: "doc-123",
      name: "empty.txt",
      status: "ready",
      text: "   ",
      chunks: [],
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderDocument();

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "The selected document has no readable text."
    );

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles document retrieval network failures", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Unable to retrieve document.")
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderDocument();

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Unable to retrieve document.");

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles an AI provider failure after loading a document", async () => {
    mockReadyDocument();

    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse(
        { error: "AI provider unavailable." },
        503
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderDocument();

    await screen.findByDisplayValue(documentText);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("AI provider unavailable.");

    expect(
      screen.queryByRole("heading", {
        name: "Generated Summary",
      })
    ).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("generates and saves a summary from a loaded document", async () => {
    mockReadyDocument();

    const generatedSummary =
      "Binary search efficiently searches sorted data.";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          summary: generatedSummary,
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse(
          {
            id: "summary-123",
            message: "Summary saved successfully.",
          },
          201
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    renderDocument();

    await screen.findByDisplayValue(documentText);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    );

    expect(
      await screen.findByText(generatedSummary)
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/ai/summarize",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          notes: documentText,
        }),
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save Summary",
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/summaries",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceText: documentText,
            summary: generatedSummary,
          }),
        })
      );
    });

    expect(
      await screen.findByText(
        "Your summary was saved successfully."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Summary Saved",
      })
    ).toBeDisabled();
  });

  it("blocks generation when document loading fails", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Document not found.")
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderDocument("missing-document");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Document not found.");

    const generateButton = screen.getByRole("button", {
      name: "Generate Summary",
    });

    expect(generateButton).toBeDisabled();

    fireEvent.click(generateButton);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
