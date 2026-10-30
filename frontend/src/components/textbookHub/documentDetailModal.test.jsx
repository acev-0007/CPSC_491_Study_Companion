import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  useLocation,
} from "react-router-dom";

import DocumentDetailModal
  from "../../components/textbookHub/DocumentDetailModal";


const READY_DOCUMENT = {
  id:
    "11111111-1111-1111-1111-111111111111",

  name:
    "operating-systems.txt",

  category:
    "Lecture Notes",

  course:
    "CPSC 491",

  type:
    "txt",

  status:
    "ready",

  size:
    100,

  textLength:
    50,

  uploadedAt:
    "2026-10-29T12:00:00.000Z",
};


const CATEGORIES = [
  "Textbook",
  "Lecture Notes",
  "Study Guide",
  "Assignment",
  "Reference",
  "Other",
];


function LocationProbe() {
  const location =
    useLocation();

  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}


function renderModal(
  document = READY_DOCUMENT
) {
  render(
    <MemoryRouter
      initialEntries={[
        "/textbooks",
      ]}
    >
      <DocumentDetailModal
        document={document}
        categories={CATEGORIES}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />

      <LocationProbe />
    </MemoryRouter>
  );
}


describe(
  "DocumentDetailModal AI study actions",

  () => {
    it(
      "enables AI actions for a ready document",

      () => {
        renderModal();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Notes",
            }
          )
        ).toBeEnabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Quiz",
            }
          )
        ).toBeEnabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Flashcards",
            }
          )
        ).toBeEnabled();
      }
    );


    it(
      "passes the document ID to Summarization",

      async () => {
        const user =
          userEvent.setup();

        renderModal();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Notes",
            }
          )
        );

        expect(
          screen.getByTestId(
            "location"
          )
        ).toHaveTextContent(
          "/summarization?documentId=11111111-1111-1111-1111-111111111111"
        );
      }
    );


    it(
      "passes the document ID to Quiz",

      async () => {
        const user =
          userEvent.setup();

        renderModal();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Quiz",
            }
          )
        );

        expect(
          screen.getByTestId(
            "location"
          )
        ).toHaveTextContent(
          "/quiz?documentId=11111111-1111-1111-1111-111111111111"
        );
      }
    );


    it(
      "passes the document ID to Flashcards",

      async () => {
        const user =
          userEvent.setup();

        renderModal();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Flashcards",
            }
          )
        );

        expect(
          screen.getByTestId(
            "location"
          )
        ).toHaveTextContent(
          "/flashcards?documentId=11111111-1111-1111-1111-111111111111"
        );
      }
    );


    it(
      "disables AI actions while a document is processing",

      () => {
        renderModal({
          ...READY_DOCUMENT,
          status:
            "processing",
        });

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Notes",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Quiz",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Flashcards",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "status"
          )
        ).toHaveTextContent(
          /unavailable until this document is ready/i
        );
      }
    );


    it(
      "disables AI actions when document processing failed",

      () => {
        renderModal({
          ...READY_DOCUMENT,
          status:
            "failed",
        });

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Notes",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Quiz",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Generate Flashcards",
            }
          )
        ).toBeDisabled();
      }
    );
  }
);