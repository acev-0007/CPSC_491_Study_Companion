
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Summarization from "../../pages/Summarization";

describe("SCRUM-273 Summarization Smoke Tests", () => {
  afterEach(() => {
    vi.unstubAllGlobals(); 
    vi.restoreAllMocks();
  });

  it("renders the summarization page and accepts manual notes", () => {
    render(
      <MemoryRouter>
        <Summarization />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Summarization" })
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(
      "Paste your notes or study material here..."
    );

    fireEvent.change(textarea, {
      target: {
        value: "Operating systems manage computer resources.",
      },
    });

    expect(textarea).toHaveValue(
      "Operating systems manage computer resources."
    );

    expect(
      screen.getByRole("button", { name: "Generate Summary" })
    ).toBeEnabled();
  });

  it("generates a summary from manually entered notes", async () => {
    const notes = "Operating systems manage computer resources.";
    const generatedSummary =
      "Operating systems coordinate hardware and software resources.";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({
          summary: generatedSummary,
        }),
      });

    render(
      <MemoryRouter>
        <Summarization />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(
      "Paste your notes or study material here..."
    );

    fireEvent.change(textarea, {
      target: { value: notes },
    });

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
            notes,
          }),
        })
      );
    });

    expect(
      await screen.findByText(generatedSummary)
    ).toBeInTheDocument();
  });

  it("prevents summary generation when notes are empty", () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
      });

    render(
      <MemoryRouter>
        <Summarization />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      "Please enter study material before generating a summary."
    );

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/ai/summarize"
      )
    ).toHaveLength(0);
  });

  it("displays an error when AI summarization fails", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/summaries" && options?.method !== "POST") {
        return {
          ok: true,
          json: async () => ({ summaries: [] }),
        };
      }

      if (url === "/api/ai/summarize") {
        return {
          ok: false,
          status: 500,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({
            error: "AI provider unavailable.",
          }),
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <Summarization />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "Paste your notes or study material here..."
      ),
      {
        target: {
          value: "Operating systems manage computer resources.",
        },
      }
    );

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
  });

  it("shows a loading state while generating a summary", async () => {
    let resolveRequest;

    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/summaries" && options?.method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: "saved-123" }),
        };
      }

      if (url === "/api/summaries") {
        return {
          ok: true,
          json: async () => ({ summaries: [] }),
        };
      }

      if (url === "/api/ai/summarize") {
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <Summarization />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "Paste your notes or study material here..."
      ),
      {
        target: {
          value: "Operating systems manage computer resources.",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    );

    expect(
      screen.getByRole("button", {
        name: "Generating Summary...",
      })
    ).toBeDisabled();

    expect(
      screen.getByText("Generating your summary...")
    ).toBeInTheDocument();

    resolveRequest({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        summary: "Operating systems manage hardware and software.",
      }),
    });

    expect(
      await screen.findByText(
        "Operating systems manage hardware and software."
      )
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Generate Summary",
        })
      ).toBeEnabled();
    });

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
    ).toHaveLength(1);
  });

});
