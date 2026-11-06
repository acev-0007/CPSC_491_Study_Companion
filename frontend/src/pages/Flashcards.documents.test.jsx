import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Flashcards from "./Flashcards";
import { getDocumentAiContent, listDocuments } from "../api/documents";
import { generateFlashcards } from "../services/flashcardGeneration";

// FLASH-11 integration: a Document Hub selection must reach the existing
// Flashcards.handleGenerate -> generateFlashcards pipeline, unchanged.
vi.mock("../data/flashcardSource", () => ({ getFlashcards: vi.fn() }));
vi.mock("../services/flashcardDecks", () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));
vi.mock("../api/documents", () => ({
  listDocuments: vi.fn(),
  getDocumentAiContent: vi.fn(),
}));
vi.mock("../services/flashcardGeneration", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, generateFlashcards: vi.fn() };
});

beforeEach(() => {
  vi.resetAllMocks();
});

async function openGenerateScreen() {
  const user = userEvent.setup();
  render(<Flashcards />);
  await user.click(screen.getByRole("button", { name: "Generate New Flashcards" }));
  return user;
}

describe("Flashcards page - Document Hub generation (FLASH-11)", () => {
  it("generates cards from a selected ready document through the existing pipeline", async () => {
    listDocuments.mockResolvedValue([{ id: "d1", name: "Biology.pdf", status: "ready" }]);
    getDocumentAiContent.mockResolvedValue({
      documentId: "d1",
      status: "ready",
      text: "Cells are the basic unit of life.",
    });
    generateFlashcards.mockResolvedValueOnce({
      flashcards: [{ front: "What is the basic unit of life?", back: "The cell." }],
      isStub: false,
    });

    const user = await openGenerateScreen();
    await user.click(screen.getByRole("button", { name: "Load my documents" }));
    await user.selectOptions(
      screen.getByLabelText("Document"),
      screen.getByRole("option", { name: "Biology.pdf" })
    );
    await user.click(screen.getByRole("button", { name: "Generate from Document" }));

    expect(await screen.findByText("What is the basic unit of life?")).toBeInTheDocument();
    expect(generateFlashcards).toHaveBeenCalledTimes(1);
    expect(generateFlashcards).toHaveBeenCalledWith("Cells are the basic unit of life.");
  });

  it("does not call the generation endpoint when document text is empty", async () => {
    listDocuments.mockResolvedValue([{ id: "d1", name: "Blank.pdf", status: "ready" }]);
    getDocumentAiContent.mockResolvedValue({ documentId: "d1", status: "ready", text: "" });

    const user = await openGenerateScreen();
    await user.click(screen.getByRole("button", { name: "Load my documents" }));
    await user.selectOptions(
      screen.getByLabelText("Document"),
      screen.getByRole("option", { name: "Blank.pdf" })
    );
    await user.click(screen.getByRole("button", { name: "Generate from Document" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no extracted text/i);
    expect(generateFlashcards).not.toHaveBeenCalled();
  });
});