import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getQuizAttempt, getQuizHistory } from "../services/quizHistory";
import "./QuizHistory.css";

const formatDate = (date) => {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "Unknown date" : value.toLocaleString();
};

function ProgressGraph({ attempts }) {
  const chronological = [...attempts].reverse();
  const width = 680;
  const height = 220;
  const left = 42;
  const right = 20;
  const top = 16;
  const bottom = 35;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (i) => left + (chronological.length === 1 ? plotWidth / 2 : i * plotWidth / (chronological.length - 1));
  const y = (score) => top + (100 - score) * plotHeight / 100;
  const points = chronological.map((a, i) => `${x(i)},${y(a.score_percent)}`).join(" ");

  return (
    <div className="quiz-history-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="quiz-history-chart" role="img" aria-label={`Quiz score progress over ${chronological.length} attempts, from oldest to newest`}>
        {[0, 25, 50, 75, 100].map((score) => (
          <g key={score}>
            <line x1={left} y1={y(score)} x2={width - right} y2={y(score)} className="quiz-history-gridline" />
            <text x={left - 8} y={y(score) + 4} textAnchor="end" className="quiz-history-axis-text">{score}%</text>
          </g>
        ))}
        {chronological.length > 1 && <polyline points={points} className="quiz-history-line" />}
        {chronological.map((a, i) => (
          <g key={a.id}>
            <circle cx={x(i)} cy={y(a.score_percent)} r="5" className="quiz-history-dot" />
            <title>{`Attempt ${i + 1}: ${a.score_percent}% (${formatDate(a.completed_at)})`}</title>
          </g>
        ))}
        <text x={width / 2} y={height - 4} textAnchor="middle" className="quiz-history-axis-text">Attempt number (oldest to newest)</text>
      </svg>
    </div>
  );
}

function AttemptReview({ id, onClose }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getQuizAttempt(id).then((data) => {
      if (active) setState({ loading: false, error: "", data });
    }).catch(() => {
      if (active) setState({ loading: false, error: "Unable to load this attempt.", data: null });
    });
    return () => { active = false; };
  }, [id, retry]);

  return (
    <section className="quiz-history-panel" aria-label="Previous attempt review">
      <div className="quiz-history-heading-row">
        <h2>Attempt review</h2>
        <button type="button" className="quiz-nav-button" onClick={onClose}>Close review</button>
      </div>
      {state.loading && <p role="status">Loading saved answers...</p>}
      {state.error && (
        <div role="alert">
          <p>{state.error}</p>
          <button type="button" className="quiz-nav-button" onClick={() => {
            setState({ loading: true, error: "", data: null });
            setRetry((n) => n + 1);
          }}>Try again</button>
        </div>
      )}
      {state.data && (
        <>
          <p className="quiz-history-muted">
            {state.data.attempt.topic} · {formatDate(state.data.attempt.completed_at)} · {state.data.attempt.score_percent}%
          </p>
          <ol className="quiz-history-answer-list">
            {state.data.answers.map((answer) => {
              const options = Array.isArray(answer.options) ? answer.options : [];
              const label = (id) => {
                const option = options.find((o) => o.id === id);
                return option ? `${id}. ${option.text}` : (id || "No answer");
              };
              return (
                <li key={answer.question_index} className="quiz-history-answer">
                  <strong>{answer.question_index + 1}. {answer.question_text}</strong>
                  <p className={answer.is_correct ? "quiz-history-correct" : "quiz-history-incorrect"}>
                    {answer.is_correct ? "Correct" : "Incorrect"} · {answer.category || "General"}
                  </p>
                  <p>Your answer: {label(answer.selected_option_id)}</p>
                  {!answer.is_correct && <p>Correct answer: {label(answer.correct_option_id)}</p>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

export default function QuizHistory() {
  const [state, setState] = useState({ loading: true, error: "", attempts: [] });
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let active = true;
    getQuizHistory().then((attempts) => {
      if (active) setState({ loading: false, error: "", attempts });
    }).catch(() => {
      if (active) setState({ loading: false, error: "Unable to load quiz history.", attempts: [] });
    });
    return () => { active = false; };
  }, [retry]);

  const attempts = useMemo(
    () => [...state.attempts].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)),
    [state.attempts]
  );
  const filtered = attempts.filter((a) => a.topic?.toLowerCase().includes(filter.toLowerCase()));
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + a.score_percent, 0) / attempts.length)
    : 0;
  const best = attempts.length ? Math.max(...attempts.map((a) => a.score_percent)) : 0;

  return (
    <main className="quiz-history-page">
      <header className="quiz-history-heading-row">
        <div>
          <h1>Quiz History</h1>
          <p className="quiz-history-muted">Review past quizzes and track your progress.</p>
        </div>
        <Link to="/quiz" className="quiz-history-link-button">Create quiz</Link>
      </header>

      {state.loading && <p role="status">Loading quiz history...</p>}
      {state.error && (
        <div className="quiz-history-panel" role="alert">
          <p>{state.error}</p>
          <button type="button" className="quiz-nav-button" onClick={() => {
            setState({ loading: true, error: "", attempts: [] });
            setRetry((n) => n + 1);
          }}>Try again</button>
        </div>
      )}
      {!state.loading && !state.error && attempts.length === 0 && (
        <section className="quiz-history-panel">
          <h2>No completed quizzes yet</h2>
          <p>Complete a quiz to start tracking your progress.</p>
          <Link to="/quiz">Create your first quiz</Link>
        </section>
      )}

      {!state.loading && !state.error && attempts.length > 0 && (
        <>
          <section className="quiz-history-stats" aria-label="Quiz performance summary">
            <div><span>Latest</span><strong>{attempts[0].score_percent}%</strong></div>
            <div><span>Best</span><strong>{best}%</strong></div>
            <div><span>Average</span><strong>{average}%</strong></div>
            <div><span>Attempts shown</span><strong>{attempts.length}</strong></div>
          </section>

          <section className="quiz-history-panel">
            <h2>Score progression</h2>
            <ProgressGraph attempts={attempts} />
            <p className="quiz-history-muted">Scores are ordered by completion date. Up to 100 recent attempts are available.</p>
          </section>

          <section className="quiz-history-panel">
            <div className="quiz-history-heading-row">
              <h2>Previous attempts</h2>
              <label className="quiz-history-filter">
                Filter by topic
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search topics" />
              </label>
            </div>
            {filtered.length === 0 ? <p>No attempts match that topic.</p> : (
              <ul className="quiz-history-attempt-list">
                {filtered.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="quiz-history-attempt" aria-pressed={selectedId === a.id} onClick={() => setSelectedId((old) => old === a.id ? null : a.id)}>
                      <span><strong>{a.topic || "General"}</strong><small>{formatDate(a.completed_at)}</small></span>
                      <span className="quiz-history-score">{a.score_percent}% <small>{a.correct_count}/{a.total_questions} correct</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {selectedId && <AttemptReview key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
        </>
      )}
    </main>
  );
}
