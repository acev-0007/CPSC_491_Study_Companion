import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextbookHub from "../pages/TextbookHub";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body, { status = 200 } = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("TextbookHub", () => {
  it("rejects an unsupported file type before upload", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ documents: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup({ applyAccept: false });
    render(<TextbookHub />);
    await screen.findByText("No documents yet");

    const fileInput = screen.getByLabelText(/add a study document/i);
    await user.upload(
      fileInput,
      new File(["fake image"], "diagram.png", { type: "image/png" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/only txt and pdf/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an uploaded item in the Hub after a successful upload", async () => {
    const created = {
      id: "doc-1",
      name: "chapter-1.txt",
      type: "txt",
      mimeType: "text/plain",
      size: 18,
      uploadedAt: "2026-09-13T12:00:00.000Z",
      status: "ready",
      extractionError: null,
      textLength: 18,
    };

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse({ documents: [] }))
      .mockImplementationOnce(() => jsonResponse({ document: created }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<TextbookHub />);
    await screen.findByText("No documents yet");

    const fileInput = screen.getByLabelText(/add a study document/i);
    const file = new File(["Chapter one notes"], "chapter-1.txt", {
      type: "text/plain",
    });

    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText("chapter-1.txt")).toBeInTheDocument();
    });
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
