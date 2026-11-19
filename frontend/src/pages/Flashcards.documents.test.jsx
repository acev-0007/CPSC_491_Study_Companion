import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Flashcards from "./Flashcards";
import {
  getDocumentAiContent,
  listDocuments,
} from "../api/documents";
import { generateFlashcards } from "../services/flashcardGeneration";

// FLASH-11 integration:
// Document Hub selections and URL handoffs must reach the existing
// Flashcards.handleGenerate -> generateFlashcards pipeline unchanged.
vi.mock("../data/flashcardSource", () => ({
  getFlashcards: vi.fn(),
}));

vi.mock("../services/flashcardDecks", () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));

vi.mock("../api/documents", () => ({
  listDocuments: vi.fn(),
  getDocumentAiContent: vi.fn(),
}));

vi.mock(
  "../services/flashcardGeneration",
  async (importOriginal) => {
    const actual =
      await importOriginal();

    return {
      ...actual,
      generateFlashcards: vi.fn(),
    };
  }
);

beforeEach(() => {
  vi.resetAllMocks();
});

function renderFlashcards(
  initialEntries = ["/flashcards"]
) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
    >
      <Flashcards />
    </MemoryRouter>
  );
}

async function openGenerateScreen() {
  const user =
    userEvent.setup();

  renderFlashcards();

  await user.click(
    screen.getByRole(
      "button",
      {
        name:
          "Generate New Flashcards",
      }
    )
  );

  return user;
}

describe(
  "Flashcards page - Document Hub generation (FLASH-11)",
  () => {
    it(
      "generates cards from a selected ready document through the existing pipeline",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Biology.pdf",
            status: "ready",
          },
        ]);

        getDocumentAiContent.mockResolvedValue({
          documentId: "d1",
          status: "ready",
          text:
            "Cells are the basic unit of life.",
        });

        generateFlashcards.mockResolvedValueOnce({
          flashcards: [
            {
              front:
                "What is the basic unit of life?",
              back:
                "The cell.",
            },
          ],
          isStub: false,
        });

        const user =
          await openGenerateScreen();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Load my documents",
            }
          )
        );

        await user.selectOptions(
          screen.getByLabelText(
            "Document"
          ),
          screen.getByRole(
            "option",
            {
              name:
                "Biology.pdf",
            }
          )
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate from Document",
            }
          )
        );

        expect(
          await screen.findByText(
            "What is the basic unit of life?"
          )
        ).toBeInTheDocument();

        expect(
          generateFlashcards
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          generateFlashcards
        ).toHaveBeenCalledWith(
          "Cells are the basic unit of life."
        );
      }
    );

    it(
      "does not call the generation endpoint when document text is empty",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Blank.pdf",
            status: "ready",
          },
        ]);

        getDocumentAiContent.mockResolvedValue({
          documentId: "d1",
          status: "ready",
          text: "",
        });

        const user =
          await openGenerateScreen();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Load my documents",
            }
          )
        );

        await user.selectOptions(
          screen.getByLabelText(
            "Document"
          ),
          screen.getByRole(
            "option",
            {
              name:
                "Blank.pdf",
            }
          )
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate from Document",
            }
          )
        );

        expect(
          await screen.findByRole(
            "alert"
          )
        ).toHaveTextContent(
          /no extracted text/i
        );

        expect(
          generateFlashcards
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "preselects the matching ready document from the documentId URL parameter",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Biology.pdf",
            status: "ready",
          },
          {
            id: "d2",
            name: "Chemistry.pdf",
            status: "ready",
          },
        ]);

        renderFlashcards([
          "/flashcards?documentId=d2",
        ]);

        expect(
          await screen.findByLabelText(
            "Document"
          )
        ).toHaveValue(
          "d2"
        );

        expect(
          listDocuments
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          generateFlashcards
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "shows an error when the documentId URL parameter does not match a document",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Biology.pdf",
            status: "ready",
          },
        ]);

        renderFlashcards([
          "/flashcards?documentId=missing-document",
        ]);

        expect(
          await screen.findByRole(
            "alert"
          )
        ).toHaveTextContent(
          /document not found/i
        );

        expect(
          screen.getByLabelText(
            "Document"
          )
        ).toHaveValue(
          ""
        );

        expect(
          generateFlashcards
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "does not preselect a failed document passed through the documentId URL parameter",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Failed Biology.pdf",
            status: "failed",
          },
        ]);

        renderFlashcards([
          "/flashcards?documentId=d1",
        ]);

        expect(
          await screen.findByRole(
            "alert"
          )
        ).toHaveTextContent(
          /still being processed/i
        );

        expect(
          screen.getByLabelText(
            "Document"
          )
        ).toHaveValue(
          ""
        );

        expect(
          generateFlashcards
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "does not preselect a processing document passed through the documentId URL parameter",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Processing Biology.pdf",
            status: "processing",
          },
        ]);

        renderFlashcards([
          "/flashcards?documentId=d1",
        ]);

        expect(
          await screen.findByRole(
            "alert"
          )
        ).toHaveTextContent(
          /still being processed/i
        );

        expect(
          screen.getByLabelText(
            "Document"
          )
        ).toHaveValue(
          ""
        );

        expect(
          generateFlashcards
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "generates flashcards from the document preselected by the URL handoff",
      async () => {
        listDocuments.mockResolvedValue([
          {
            id: "d1",
            name: "Biology.pdf",
            status: "ready",
          },
          {
            id: "d2",
            name: "Chemistry.pdf",
            status: "ready",
          },
        ]);

        getDocumentAiContent.mockResolvedValue({
          documentId: "d2",
          status: "ready",
          text:
            "Atoms form chemical bonds.",
        });

        generateFlashcards.mockResolvedValueOnce({
          flashcards: [
            {
              front:
                "What can atoms form?",
              back:
                "Chemical bonds.",
            },
          ],
          isStub: false,
        });

        const user =
          userEvent.setup();

        renderFlashcards([
          "/flashcards?documentId=d2",
        ]);

        expect(
          await screen.findByLabelText(
            "Document"
          )
        ).toHaveValue(
          "d2"
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate from Document",
            }
          )
        );

        expect(
          getDocumentAiContent
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          getDocumentAiContent
        ).toHaveBeenCalledWith(
          "d2",
          expect.objectContaining({
            signal:
              expect.any(
                AbortSignal
              ),
          })
        );

        expect(
          generateFlashcards
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          generateFlashcards
        ).toHaveBeenCalledWith(
          "Atoms form chemical bonds."
        );

        expect(
          await screen.findByText(
            "What can atoms form?"
          )
        ).toBeInTheDocument();
      }
    );
  }
);