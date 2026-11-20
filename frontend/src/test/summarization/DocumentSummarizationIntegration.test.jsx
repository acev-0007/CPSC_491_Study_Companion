
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
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: saved-summary history loads successfully.
    fetchMock = vi.fn(async (url, options) => {
      if (
        url === "/api/summaries" &&
        options?.method !== "POST"
      ) {
        return mockJsonResponse({ summaries: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects a document with empty extracted text", async () => {
    getAiReadyDocumentContent.mockResolvedValue({
      documentId: "doc-123",
      name: "empty.txt",
      status: "ready",
      text: "   ",
      chunks: [],
    });

    renderDocument();

    expect(
      await screen.findByText(
        "The selected document has no readable text."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/summarize"
      )
    ).toHaveLength(0);
  });

  it("handles document retrieval network failures", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Unable to retrieve document.")
    );

    renderDocument();

    expect(
      await screen.findByText("Unable to retrieve document.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeDisabled();

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/summarize"
      )
    ).toHaveLength(0);
  });

  it("handles an AI provider failure after loading a document", async () => {
    mockReadyDocument();

    fetchMock.mockImplementation(async (url, options) => {
      if (
        url === "/api/summaries" &&
        options?.method !== "POST"
      ) {
        return mockJsonResponse({ summaries: [] });
      }

      if (url === "/api/ai/summarize") {
        return mockJsonResponse(
          { error: "AI provider unavailable." },
          503
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    renderDocument();

    await screen.findByDisplayValue(documentText);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    );

    expect(
      await screen.findByText("AI provider unavailable.")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Generated Summary",
      })
    ).not.toBeInTheDocument();

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/summarize"
      )
    ).toHaveLength(1);

    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          url === "/api/summaries" &&
          options?.method === "POST"
      )
    ).toHaveLength(0);
  });

  it("generates and automatically saves a summary from a loaded document", async () => {
    mockReadyDocument();

    const generatedSummary =
      "Binary search efficiently searches sorted data.";

    fetchMock.mockImplementation(async (url, options) => {
      if (
        url === "/api/summaries" &&
        options?.method === "POST"
      ) {
        return mockJsonResponse(
          {
            id: "summary-123",
            message: "Summary saved successfully.",
          },
          201
        );
      }

      if (url === "/api/summaries") {
        return mockJsonResponse({ summaries: [] });
      }

      if (url === "/api/ai/summarize") {
        return mockJsonResponse({
          summary: generatedSummary,
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ai/summarize",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            notes: documentText,
          }),
        })
      );

      expect(fetchMock).toHaveBeenCalledWith(
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
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          url === "/api/summaries" &&
          options?.method === "POST"
      )
    ).toHaveLength(1);
  });

  it("blocks generation when document loading fails", async () => {
    getAiReadyDocumentContent.mockRejectedValue(
      new Error("Document not found.")
    );

    renderDocument("missing-document");

    expect(
      await screen.findByText("Document not found.")
    ).toBeInTheDocument();

    const generateButton = screen.getByRole("button", {
      name: "Generate Summary",
    });

    expect(generateButton).toBeDisabled();

    fireEvent.click(generateButton);

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/summarize"
      )
    ).toHaveLength(0);
  });
});
