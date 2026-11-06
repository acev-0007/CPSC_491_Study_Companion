import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import StudyMaterialInput from "./StudyMaterialInput";
import { getDocumentAiContent, listDocuments } from "../api/documents";
import { MAX_STUDY_TEXT_LENGTH } from "../services/flashcardGeneration";

vi.mock("../api/documents", () => ({
  listDocuments: vi.fn(),
  getDocumentAiContent: vi.fn(),
}));

// FLASH-11 component tests (F11-01 .. F11-09). The documents API and
// onGenerate are mocked: these cover selector, validation, and reliability UI.
const DOCS = [
  { id: "d1", name: "Biology Ch1.pdf", status: "ready" },
  { id: "d2", name: "Chemistry.txt", status: "ready" },
  { id: "d3", name: "Scan.pdf", status: "processing" },
  { id: "d4", name: "Broken.pdf", status: "failed" },
];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function httpError(status) {
  const error = new Error("server detail that must not be shown");
  error.status = status;
  return error;
}

async function setup({ docs = DOCS, onGenerate } = {}) {
  listDocuments.mockResolvedValue(docs);
  const generate = onGenerate ?? vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const view = render(<StudyMaterialInput onGenerate={generate} />);
  await user.click(screen.getByRole("button", { name: "Load my documents" }));
  return { user, onGenerate: generate, ...view };
}

const selectEl = () => screen.getByLabelText("Document");
const docButton = () =>
  screen.getByRole("button", { name: /generate from document|loading document|generating from document/i });

async function choose(user, name) {
  await user.selectOptions(selectEl(), screen.getByRole("option", { name }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("F11-01/02/03 document list", () => {
  it("does not load documents until the student asks", () => {
    render(<StudyMaterialInput onGenerate={vi.fn()} />);
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it("F11-01: lists ready documents as selectable options", async () => {
    await setup();

    expect(screen.getByRole("option", { name: "Biology Ch1.pdf" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Chemistry.txt" })).toBeEnabled();
  });

  it("F11-02: shows a helpful empty state and cannot generate", async () => {
    const { onGenerate } = await setup({ docs: [] });

    expect(screen.getByRole("status")).toHaveTextContent(/no documents yet/i);
    expect(screen.queryByLabelText("Document")).not.toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("F11-03: non-ready documents are visible but not selectable", async () => {
    await setup();

    expect(screen.getByRole("option", { name: "Scan.pdf (processing)" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Broken.pdf (failed)" })).toBeDisabled();
  });

  it("explains when documents exist but none are ready", async () => {
    await setup({ docs: [DOCS[2]] });

    expect(screen.getByRole("status")).toHaveTextContent(/none of your documents are ready/i);
  });

  it("keeps the generate button disabled until a document is chosen", async () => {
    await setup();

    expect(docButton()).toBeDisabled();
  });

  it.each([
    [401, /sign in again/i],
    [403, /do not have access/i],
    [500, /could not load your documents/i],
  ])("shows a safe message when listing fails with %i", async (status, message) => {
    listDocuments.mockRejectedValue(httpError(status));
    const user = userEvent.setup();
    render(<StudyMaterialInput onGenerate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Load my documents" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/server detail/);
  });

  it("shows a network message when listing cannot reach the server", async () => {
    listDocuments.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<StudyMaterialInput onGenerate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Load my documents" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
  });
});

describe("F11-04 valid document", () => {
  it("fetches text and calls onGenerate once with the validated text", async () => {
    getDocumentAiContent.mockResolvedValue({
      documentId: "d1",
      status: "ready",
      text: "  Mitochondria make ATP.  ",
    });
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(getDocumentAiContent).toHaveBeenCalledTimes(1);
    expect(getDocumentAiContent.mock.calls[0][0]).toBe("d1");
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith("Mitochondria make ATP.");
  });

  it("shows loading then generating states and restores the form", async () => {
    const content = deferred();
    const generation = deferred();
    getDocumentAiContent.mockReturnValue(content.promise);
    const onGenerate = vi.fn(() => generation.promise);
    const { user } = await setup({ onGenerate });

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    expect(screen.getByRole("button", { name: "Loading document..." })).toBeDisabled();

    await act(async () => {
      content.resolve({ documentId: "d1", status: "ready", text: "notes" });
    });
    expect(screen.getByRole("button", { name: "Generating from document..." })).toBeDisabled();
    expect(selectEl()).toBeDisabled();

    await act(async () => {
      generation.resolve();
    });
    expect(screen.getByRole("button", { name: "Generate from Document" })).toBeEnabled();
  });

  it("shows an error when generation fails and allows retry", async () => {
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "ready", text: "notes" });
    const onGenerate = vi.fn().mockRejectedValue(new Error("provider down"));
    const { user } = await setup({ onGenerate });

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not generate flashcards/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/provider down/);
    expect(docButton()).toBeEnabled();
  });
});

describe("F11-05/06 content validation", () => {
  it.each([
    ["empty string", ""],
    ["whitespace", "   \n  "],
    ["missing", undefined],
  ])("F11-05: rejects %s content with no generation", async (_label, text) => {
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "ready", text });
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/no extracted text/i);
    expect(onGenerate).not.toHaveBeenCalled();
    expect(docButton()).toBeEnabled();
  });

  it("F11-06: rejects over-limit content explicitly and never truncates", async () => {
    getDocumentAiContent.mockResolvedValue({
      documentId: "d1",
      status: "ready",
      text: "a".repeat(MAX_STUDY_TEXT_LENGTH + 1),
    });
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/too long.*not truncated/i);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("rejects a response whose status is not ready, even if text is present", async () => {
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "processing", text: "x" });
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/still being processed/i);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("rejects a response for a different document than requested", async () => {
    getDocumentAiContent.mockResolvedValue({ documentId: "other", status: "ready", text: "x" });
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("F11-07 request failures", () => {
  it.each([
    [401, /sign in again/i],
    [403, /do not have access/i],
    [404, /could not be found/i],
    [409, /still being processed/i],
    [422, /could not be extracted/i],
    [500, /could not load this document/i],
  ])("shows a safe message for %i and never generates", async (status, message) => {
    getDocumentAiContent.mockRejectedValue(httpError(status));
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/server detail/);
    expect(onGenerate).not.toHaveBeenCalled();
    expect(docButton()).toBeEnabled();
  });

  it("shows a network message and never generates", async () => {
    getDocumentAiContent.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("F11-08 duplicate submission", () => {
  it("a double-click triggers one fetch and one generation", async () => {
    const generation = deferred();
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "ready", text: "notes" });
    const onGenerate = vi.fn(() => generation.promise);
    const { user } = await setup({ onGenerate });

    await choose(user, "Biology Ch1.pdf");
    await user.dblClick(docButton());

    expect(getDocumentAiContent).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledTimes(1);

    await act(async () => {
      generation.resolve();
    });
  });

  it("synchronous repeated submits are blocked by the ref guard", async () => {
    const content = deferred();
    getDocumentAiContent.mockReturnValue(content.promise);
    const { user, container } = await setup();

    await choose(user, "Biology Ch1.pdf");
    const form = container.querySelector(".study-input-documents");
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(getDocumentAiContent).toHaveBeenCalledTimes(1);

    await act(async () => {
      content.resolve({ documentId: "d1", status: "ready", text: "notes" });
    });
  });

  it("paste and document paths share one guard", async () => {
    const generation = deferred();
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "ready", text: "doc notes" });
    const onGenerate = vi.fn(() => generation.promise);
    const { user, container } = await setup({ onGenerate });

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    expect(onGenerate).toHaveBeenCalledTimes(1);

    // Paste submit attempted while the document generation is running.
    fireEvent.change(screen.getByLabelText("Paste Study Notes"), { target: { value: "pasted" } });
    fireEvent.submit(container.querySelector("form"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Generate Flashcards" })).toBeDisabled();

    await act(async () => {
      generation.resolve();
    });
  });
});

describe("F11-09 stale requests", () => {
  it("ignores a late response after the selection changes", async () => {
    const first = deferred();
    getDocumentAiContent.mockImplementation((id) =>
      id === "d1"
        ? first.promise
        : Promise.resolve({ documentId: "d2", status: "ready", text: "chemistry notes" })
    );
    const { user, onGenerate } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    expect(screen.getByRole("button", { name: "Loading document..." })).toBeDisabled();

    // Student switches while the first request is still pending.
    await choose(user, "Chemistry.txt");
    expect(docButton()).toBeEnabled();

    await act(async () => {
      first.resolve({ documentId: "d1", status: "ready", text: "biology notes" });
    });

    expect(onGenerate).not.toHaveBeenCalled();
    expect(selectEl()).toHaveValue("d2");

    // The current selection still works normally.
    await user.click(docButton());
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith("chemistry notes");
  });

  it("aborts the superseded request", async () => {
    getDocumentAiContent.mockReturnValue(new Promise(() => {}));
    const { user } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    const { signal } = getDocumentAiContent.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    await choose(user, "Chemistry.txt");
    expect(signal.aborted).toBe(true);
  });

  it("ignores a late failure from a superseded request", async () => {
    const first = deferred();
    getDocumentAiContent.mockReturnValue(first.promise);
    const { user } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    await choose(user, "Chemistry.txt");

    await act(async () => {
      first.reject(httpError(404));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not generate after the input is unmounted", async () => {
    const content = deferred();
    getDocumentAiContent.mockReturnValue(content.promise);
    const { user, onGenerate, unmount } = await setup();

    await choose(user, "Biology Ch1.pdf");
    await user.click(docButton());
    unmount();

    await act(async () => {
      content.resolve({ documentId: "d1", status: "ready", text: "late" });
    });

    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("clears a selection that is no longer ready after a refresh", async () => {
    const { user } = await setup();
    await choose(user, "Biology Ch1.pdf");

    listDocuments.mockResolvedValue([{ ...DOCS[0], status: "processing" }, DOCS[1]]);
    await user.click(screen.getByRole("button", { name: "Refresh documents" }));

    expect(await screen.findByRole("option", { name: "Biology Ch1.pdf (processing)" })).toBeDisabled();
    expect(selectEl()).toHaveValue("");
    expect(docButton()).toBeDisabled();
  });
});

describe("F11-10 paste flow alongside documents", () => {
  it("still generates from pasted notes without touching Document Hub", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StudyMaterialInput onGenerate={onGenerate} />);

    await user.type(screen.getByLabelText("Paste Study Notes"), "Encapsulation");
    await user.click(screen.getByRole("button", { name: "Generate Flashcards" }));

    expect(onGenerate).toHaveBeenCalledWith("Encapsulation");
    expect(listDocuments).not.toHaveBeenCalled();
    expect(getDocumentAiContent).not.toHaveBeenCalled();
  });
});