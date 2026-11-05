
import { useEffect, useState } from "react";

function RecentSummaries() {
  const [summaries, setSummaries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummaries() {
      try {
        const response = await fetch("/api/summaries", {
          credentials: "same-origin",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load saved summaries."
          );
        }

        if (!Array.isArray(data.summaries)) {
          throw new Error("Invalid summaries response.");
        }

        if (!cancelled) {
          setSummaries(data.summaries);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
            "Unable to load saved summaries."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSummaries();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p role="status">Loading saved summaries...</p>;
  }

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (summaries.length === 0) {
    return <p>No saved summaries yet.</p>;
  }

  return (
    <div className="recent-summaries">
      <h3>Saved Summaries</h3>

      {summaries.map((item) => (
        <article key={item.id} className="recent-summary-item">
          <button
            type="button"
            aria-expanded={selectedId === item.id}
            onClick={() =>
              setSelectedId(
                selectedId === item.id ? null : item.id
              )
            }
          >
            Summary from{" "}
            {new Date(item.createdAt).toLocaleDateString()}
          </button>

          {selectedId === item.id && (
            <div className="recent-summary-detail">
              <h4>Generated Summary</h4>
              <p>{item.summary}</p>

              <h4>Original Study Material</h4>
              <p>{item.sourceText}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default RecentSummaries;
