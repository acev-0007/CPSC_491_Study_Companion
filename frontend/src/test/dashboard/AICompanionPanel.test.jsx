
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

import AICompanionPanel from "../../components/AICompanionPanel/AICompanionPanel";

function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("Dashboard AI Study Chat", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("enables Send when a question is entered", () => {
    render(<AICompanionPanel />);

    const input = screen.getByRole("textbox", {
      name: "Ask your study companion",
    });

    const sendButton = screen.getByRole("button", {
      name: "Send",
    });

    expect(input).toBeEnabled();
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, {
      target: { value: "Explain binary search." },
    });

    expect(sendButton).toBeEnabled();
  });

  it("sends a question and displays Claude's response", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        reply: "Binary search divides a sorted array in half.",
      })
    );

    render(<AICompanionPanel />);

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Ask your study companion",
      }),
      {
        target: { value: "What is binary search?" },
      }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Send" })
    );

    expect(
      await screen.findByText(
        "Binary search divides a sorted array in half."
      )
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          message: "What is binary search?",
          history: [],
        }),
      })
    );
  });

  it("includes previous messages in follow-up questions", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ reply: "Binary search uses sorted data." })
      )
      .mockResolvedValueOnce(
        mockResponse({ reply: "Here is an example." })
      );

    render(<AICompanionPanel />);

    const input = screen.getByRole("textbox", {
      name: "Ask your study companion",
    });

    fireEvent.change(input, {
      target: { value: "Explain binary search." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Send" })
    );

    await screen.findByText(
      "Binary search uses sorted data."
    );

    fireEvent.change(input, {
      target: { value: "Give me an example." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Send" })
    );

    await screen.findByText("Here is an example.");

    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1][1].body
    );

    expect(secondRequest.history).toEqual([
      {
        role: "user",
        content: "Explain binary search.",
      },
      {
        role: "assistant",
        content: "Binary search uses sorted data.",
      },
    ]);
  });

  it("displays an error and allows retrying", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ error: "AI unavailable." }, 500)
      )
      .mockResolvedValueOnce(
        mockResponse({ reply: "Retry successful." })
      );

    render(<AICompanionPanel />);

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Ask your study companion",
      }),
      {
        target: { value: "Explain recursion." },
      }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Send" })
    );

    expect(
      await screen.findByText("AI unavailable.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry message",
      })
    );

    expect(
      await screen.findByText("Retry successful.")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Explain recursion.")
    ).toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the conversation", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ reply: "A study response." })
    );

    render(<AICompanionPanel />);

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Ask your study companion",
      }),
      {
        target: { value: "Explain algorithms." },
      }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Send" })
    );

    await screen.findByText("A study response.");

    fireEvent.click(
      screen.getByRole("button", { name: "Clear chat" })
    );

    expect(
      screen.getByText("What would you like to study?")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("A study response.")
    ).not.toBeInTheDocument();
  });

    it("dismisses a failed message and restores the composer", async () => {
        fetchMock.mockResolvedValue(
            mockResponse({ error: "AI unavailable." }, 500)
        );
        render(<AICompanionPanel />);
        const input = screen.getByRole("textbox", {
            name: "Ask your study companion",
        });

        fireEvent.change(input, {
            target: { value: "Explain recursion." },
        });

        fireEvent.click(screen.getByRole("button", { name: "Send" }));

        expect(
            await screen.findByText("AI unavailable.")
        ).toBeInTheDocument();

        expect(input).toBeDisabled();

        fireEvent.click(
            screen.getByRole("button", { name: "Dismiss" })
        );

        expect(input).toBeEnabled();
        expect(
            screen.queryByText("AI unavailable.")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("Explain recursion.")
        ).not.toBeInTheDocument();
        });

        it("supports Enter to send and Shift+Enter for a new line", async () => {
        fetchMock.mockResolvedValue(
            mockResponse({ reply: "Recursion calls itself." })
        );

        render(<AICompanionPanel />);

        const input = screen.getByRole("textbox", {
            name: "Ask your study companion",
        });

        fireEvent.change(input, {
            target: { value: "Explain recursion." },
        });

        fireEvent.keyDown(input, {
            key: "Enter",
            shiftKey: true,
        });

        expect(fetchMock).not.toHaveBeenCalled();

        fireEvent.keyDown(input, {
            key: "Enter",
            shiftKey: false,
        });

        expect(
            await screen.findByText("Recursion calls itself.")
        ).toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("clears chat while a request is pending", async () => {
        let resolveRequest;

        fetchMock.mockImplementation(
            () =>
            new Promise((resolve) => {
                resolveRequest = resolve;
            })
        );

        render(<AICompanionPanel />);

        fireEvent.change(
            screen.getByRole("textbox", {
            name: "Ask your study companion",
            }),
            {
            target: { value: "Explain algorithms." },
            }
        );

        fireEvent.click(
            screen.getByRole("button", { name: "Send" })
        );

        expect(
            screen.getByText("Study Companion is thinking...")
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "Clear chat" })
        );

        resolveRequest(
            mockResponse({ reply: "This response should be ignored." })
        );

        await waitFor(() => {
            expect(
            screen.getByText("What would you like to study?")
            ).toBeInTheDocument();
        });

        expect(
            screen.queryByText("This response should be ignored.")
        ).not.toBeInTheDocument();
    });

});
