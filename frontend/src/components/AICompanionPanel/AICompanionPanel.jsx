import "./AICompanionPanel.css";

function AICompanionPanel() {
  return (
    <section className="ai-companion-panel" aria-labelledby="ai-companion-heading">
      <div className="ai-companion-header">
        <div>
          <p className="dashboard-eyebrow">AI workspace</p>
          <h2 id="ai-companion-heading">AI Study Companion</h2>
          <p>
            Ask questions and work through what you are studying from one place.
          </p>
        </div>
      </div>

      <div className="ai-companion-empty">
        <div className="ai-companion-empty-copy">
          <h3>AI chat is not connected yet</h3>
          <p>
            Your study conversations will appear here once the companion service is
            connected to the dashboard.
          </p>
        </div>
      </div>

      <div
        className="ai-companion-composer"
        aria-describedby="ai-companion-disabled-help"
      >
        <label className="sr-only" htmlFor="ai-companion-input">
          Ask your study companion
        </label>
        <textarea
          disabled
          id="ai-companion-input"
          placeholder="Ask your study companion..."
          rows="2"
        />
        <button disabled type="button">
          Send
        </button>
      </div>

      <p className="ai-companion-help" id="ai-companion-disabled-help">
        The composer is disabled until AI chat integration is available.
      </p>
    </section>
  );
}

export default AICompanionPanel;
