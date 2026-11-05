import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import StudyMaterialInput from "./StudyMaterialInput";

// Black-box component tests for SCRUM-121.
// onGenerate is mocked so these tests cover only input, validation,
// loading, and error UI—not the shared AI provider.
const GENERATE = {
  name: /^(generate flashcards|generating\.\.\.)$/i,
};

function setup(onGenerate = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup();
  render(<StudyMaterialInput onGenerate={onGenerate} />);
  return { user, onGenerate };
}

describe("StudyMaterialInput - paste input", () => {
  it("renders the notes textarea, a 0 character counter, and the generate button", () => {
    setup();

    expect(screen.getByLabelText("Paste Study Notes")).toBeInTheDocument();
    expect(
    screen.getByText("0 / 20,000 characters")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", GENERATE)).toBeEnabled();
  });

  it("updates the character counter as the student types", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Paste Study Notes"), "hello");

    expect(screen.getByText("5 / 20,000 characters")).toBeInTheDocument();
  });
});

describe("StudyMaterialInput - validation", () => {
  it("blocks empty submission and shows an alert", async () => {
    const { user, onGenerate } = setup();

    await user.click(screen.getByRole("button", GENERATE));

    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/paste some study notes/i);
  });

  it("blocks whitespace-only submission", async () => {
    const { user, onGenerate } = setup();

    await user.type(screen.getByLabelText("Paste Study Notes"), "   ");
    await user.click(screen.getByRole("button", GENERATE));

    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears the validation error once the student starts typing", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", GENERATE));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Paste Study Notes"), "a");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("StudyMaterialInput - generation", () => {
  it("passes the trimmed notes to onGenerate", async () => {
    const { user, onGenerate } = setup();

    await user.type(screen.getByLabelText("Paste Study Notes"), "  Encapsulation  ");
    await user.click(screen.getByRole("button", GENERATE));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith("Encapsulation");
  });

  it("shows a loading state while generating, then restores the form", async () => {
    let finish;
    const onGenerate = vi.fn(
      () => new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { user } = setup(onGenerate);

    await user.type(screen.getByLabelText("Paste Study Notes"), "notes");
    await user.click(screen.getByRole("button", GENERATE));

    expect(screen.getByRole("button", { name: "Generating..." })).toBeDisabled();
    expect(screen.getByLabelText("Paste Study Notes")).toBeDisabled();

    await act(async () => {
      finish();
    });

    expect(screen.getByRole("button", { name: "Generate Flashcards" })).toBeEnabled();
    expect(screen.getByLabelText("Paste Study Notes")).toBeEnabled();
  });

  it("shows an error and re-enables the form when generation fails", async () => {
    const onGenerate = vi.fn().mockRejectedValue(new Error("service down"));
    const { user } = setup(onGenerate);

    await user.type(screen.getByLabelText("Paste Study Notes"), "notes");
    await user.click(screen.getByRole("button", GENERATE));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not generate flashcards/i
    );
    expect(screen.getByRole("button", GENERATE)).toBeEnabled();
  });
});

describe("StudyMaterialInput - Document Hub placeholder", () => {
  it("shows the Document Hub option as visible but disabled", () => {
    setup();

    expect(screen.getByText(/select from document hub/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a document" })).toBeDisabled();
  });
});
