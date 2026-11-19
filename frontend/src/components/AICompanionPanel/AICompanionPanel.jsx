
import { useEffect, useRef, useState } from "react";
import "./AICompanionPanel.css";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 12;

function AICompanionPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedMessage, setFailedMessage] = useState(null);

  const requestRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Cancel pending requests when leaving the Dashboard.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  const sendMessage = async (text = input, retryMessageId = null) => {
    const question = text.trim();

    if (
      !question ||
      question.length > MAX_MESSAGE_LENGTH ||
      requestRef.current
    ) {
      return;
    }

    // Only successful conversation messages become context.
    // The full conversation remains visible in React state.
    const history = messages
      .filter(
        (message) =>
          message.status !== "failed" &&
          message.id !== retryMessageId
      )
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));

    const controller = new AbortController();
    requestRef.current = controller;

    setIsLoading(true);
    setError("");
    setFailedMessage(null);

    const userMessage = {
      id: retryMessageId || crypto.randomUUID(),
      role: "user",
      content: question,
    };

    if (retryMessageId) {
      // Reuse the failed message instead of creating a duplicate.
      setMessages((previous) =>
        previous.map((message) =>
          message.id === retryMessageId
            ? { ...message, status: undefined }
            : message
        )
      );
    } else {
      setMessages((previous) => [...previous, userMessage]);
      setInput("");
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          history,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to send your message."
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The study assistant returned an empty response.");
      }

      if (requestRef.current !== controller) return;

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply.trim(),
        },
      ]);
    } catch (requestError) {
      if (controller.signal.aborted) return;

      setError(
        requestError.message ||
        "Unable to send your message. Please try again."
      );
      setFailedMessage(question);

      setMessages((previous) =>
        previous.map((message) =>
          message.id === userMessage.id
            ? { ...message, status: "failed" }
            : message
        )
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const handleRetry = () => {
    if (!failedMessage || requestRef.current) return;

    const failedEntry = messages.findLast(
      (message) =>
        message.role === "user" &&
        message.status === "failed"
    );

    if (!failedEntry) return;

    sendMessage(failedEntry.content, failedEntry.id);
  };
  const handleDismissError = () => {
    setMessages((previous) =>
      previous.filter((message) => message.status !== "failed")
    );

    setError("");
    setFailedMessage(null);
  };
  const handleClearChat = () => {
    requestRef.current?.abort();
    requestRef.current = null;

    setMessages([]);
    setInput("");
    setError("");
    setFailedMessage(null);
    setIsLoading(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  return (
    <section
      className="ai-companion-panel"
      aria-labelledby="ai-companion-heading"
    >
      <div className="ai-companion-header">
        <div>
          <p className="dashboard-eyebrow">AI workspace</p>
          <h2 id="ai-companion-heading">AI Study Companion</h2>
          <p>
            Ask questions and work through what you are studying
            from one place.
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="ai-companion-empty">
          <div className="ai-companion-empty-copy">
            <h3>What would you like to study?</h3>
            <p>
              Ask a question, explore a concept, or get help
              understanding your coursework.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="ai-companion-messages"
          aria-label="Study conversation"
          role="log"
          aria-live="polite"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-companion-message ${message.role}`}
            >
              <span className="ai-companion-message-label">
                {message.role === "user"
                  ? "You"
                  : "Study Companion"}
              </span>

              <p className="ai-companion-message-content">
                {message.content}
              </p>
            </div>
          ))}

          {isLoading && (
            <p className="ai-companion-loading" role="status">
              Study Companion is thinking...
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {messages.length > 0 && (
        <div className="ai-companion-actions">
          <button
            type="button"
            className="ai-companion-clear"
            onClick={handleClearChat}
          >
            Clear chat
          </button>
        </div>
      )}
      {error && (
        <div className="ai-companion-error" role="alert">
          <p>{error}</p>

          {failedMessage && (
            <>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isLoading}
              >
                Retry message
              </button>

              <button
                type="button"
                onClick={handleDismissError}
                disabled={isLoading}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      )}


      <form
        className="ai-companion-composer"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="ai-companion-input">
          Ask your study companion
        </label>

        <textarea
          id="ai-companion-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask your study companion..."
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          disabled={isLoading || Boolean(failedMessage)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!isLoading && !failedMessage) {
                sendMessage();
              }
            }
          }}
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading || Boolean(failedMessage)}
        >
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </form>

      <p className="ai-companion-help">
        Press Enter to send. Shift + Enter for a new line.
        Chat history is kept for this session only.
      </p>
    </section>
  );
}

export default AICompanionPanel;
