import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Quiz from "./Quiz";
import { mockQuiz } from "../data/mockQuiz";

// SCRUM-125: setup -> generate -> take quiz. Only the network (fetch) is
// stubbed; the real service, setup screen, and Quiz UI all run.

const DOC = { id: "doc-1", name: "CPSC 351 Notes.pdf", status: "ready" };

function stubApi({ quizResponse, documentText = "Deadlock notes." } = {}) {
  const fetchMock = vi.fn((url) => {
    if (url === "/api/documents") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            documents: [DOC, { id: "doc-2", name: "Bad.pdf", status: "failed" }],
          }),
      });
    }
    if (String(url).endsWith("/ai-content")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: DOC.name, text: documentText }),
      });
    }
    return quizResponse();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const quizOk = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ questions: mockQuiz }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Quiz generation flow", () => {
  it("shows setup first, lists only ready documents, and keeps Create disabled when empty", async () => {
    stubApi({ quizResponse: quizOk });
    render(<Quiz />);

    expect(
      screen.getByRole("heading", { name: "Create a quiz" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: DOC.name })
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bad.pdf" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create Quiz" })).toBeDisabled();
  });

  it("generates from pasted notes and shows the first generated question", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ quizResponse: quizOk });
    render(<Quiz />);

    await user.type(screen.getByLabelText("Study material"), "Mutex notes");
    await user.click(screen.getByRole("button", { name: "Create Quiz" }));

    expect(
      await screen.findByRole("heading", { name: mockQuiz[0].question })
    ).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();

    const quizCall = fetchMock.mock.calls.find(([url]) => url === "/api/ai/quiz");
    expect(JSON.parse(quizCall[1].body)).toEqual({ notes: "Mutex notes" });
  });

  it("loads a Document Hub file into the notes box and generates from it", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ quizResponse: quizOk });
    render(<Quiz />);

    await user.selectOptions(
      await screen.findByLabelText(/Document Hub file/),
      DOC.id
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Study material")).toHaveValue(
        "Deadlock notes."
      )
    );

    await user.click(screen.getByRole("button", { name: "Create Quiz" }));
    await screen.findByText("Question 1 of 5");

    const quizCall = fetchMock.mock.calls.find(([url]) => url === "/api/ai/quiz");
    expect(JSON.parse(quizCall[1].body).notes).toBe("Deadlock notes.");
  });

  it("truncates a long document to the 20,000-character limit and says so", async () => {
    const user = userEvent.setup();
    stubApi({ quizResponse: quizOk, documentText: "x".repeat(30000) });
    render(<Quiz />);

    await user.selectOptions(
      await screen.findByLabelText(/Document Hub file/),
      DOC.id
    );

    await screen.findByText(/first 20,000 characters/);
    expect(screen.getByLabelText("Study material").value).toHaveLength(20000);
  });

  it("stays on setup and shows the error when generation fails", async () => {
    const user = userEvent.setup();
    stubApi({
      quizResponse: () =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Quiz generation failed." }),
        }),
    });
    render(<Quiz />);

    await user.type(screen.getByLabelText("Study material"), "Notes");
    await user.click(screen.getByRole("button", { name: "Create Quiz" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Quiz generation failed."
    );
    expect(
      screen.getByRole("heading", { name: "Create a quiz" })
    ).toBeInTheDocument();
  });

  it("sends only one request when Create Quiz is clicked twice quickly", async () => {
    const user = userEvent.setup();
    let release;
    const fetchMock = stubApi({
      quizResponse: () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({ questions: mockQuiz }),
            });
        }),
    });
    render(<Quiz />);

    await user.type(screen.getByLabelText("Study material"), "Notes");
    const button = screen.getByRole("button", { name: "Create Quiz" });
    await user.dblClick(button);

    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/quiz")
    ).toHaveLength(1);

    release();
    await screen.findByText("Question 1 of 5");
  });

  it("New quiz returns to setup", async () => {
    const user = userEvent.setup();
    stubApi({ quizResponse: quizOk });
    render(<Quiz />);

    await user.type(screen.getByLabelText("Study material"), "Notes");
    await user.click(screen.getByRole("button", { name: "Create Quiz" }));
    await screen.findByText("Question 1 of 5");

    await user.click(screen.getByRole("button", { name: "New quiz" }));

    expect(
      screen.getByRole("heading", { name: "Create a quiz" })
    ).toBeInTheDocument();
  });
});