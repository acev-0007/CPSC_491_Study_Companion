
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Summarization from "../../pages/Summarization";

describe("SCRUM-273 Summarization Smoke Tests", () => {
  afterEach(() => {
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

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("displays an error when AI summarization fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        error: "AI provider unavailable.",
      }),
    });

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
      await screen.findByRole("alert")
    ).toHaveTextContent("AI provider unavailable.");

    expect(
      screen.queryByRole("heading", {
        name: "Generated Summary",
      })
    ).not.toBeInTheDocument();
  });

  it("shows a loading state while generating a summary", async () => {
    let resolveRequest;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

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

    expect(
      screen.getByRole("button", {
        name: "Generate Summary",
      })
    ).toBeEnabled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
