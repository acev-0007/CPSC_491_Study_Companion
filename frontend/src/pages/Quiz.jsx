
import { useEffect, useRef, useState } from "react";

import QuizSetup from "../components/QuizSetup";
import { submitQuizAttempt } from "../services/quizHistory";
import "./Quiz.css";

// SCRUM-124: Multiple-choice quiz interface.
// SCRUM-125: AI-generated questions.
// SCRUM-128: Trusted quiz attempt persistence.
//
// The frontend provides immediate practice feedback.
// PostgreSQL calculates the authoritative saved score.

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Score ring: no external chart dependency.
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_GAP = 3;

function ScoreRing({
  correctCount,
  incorrectCount,
  totalCount,
  scorePercent,
}) {
  const hasBothArcs =
    correctCount > 0 && incorrectCount > 0;

  const gap = hasBothArcs ? RING_GAP : 0;

  const correctLength = Math.max(
    (correctCount / totalCount) * RING_CIRCUMFERENCE - gap,
    0
  );

  const incorrectLength = Math.max(
    (incorrectCount / totalCount) * RING_CIRCUMFERENCE - gap,
    0
  );

  const incorrectOffset = -(
    (correctCount / totalCount) * RING_CIRCUMFERENCE
  );

  return (
    <div
      className="quiz-ring"
      role="img"
      aria-label={`${correctCount} of ${totalCount} correct, ${incorrectCount} incorrect, ${scorePercent} percent`}
    >
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        focusable="false"
      >
        <g
          transform="rotate(-90 60 60)"
          fill="none"
          strokeWidth="14"
        >
          <circle
            className="quiz-ring-track"
            cx="60"
            cy="60"
            r={RING_RADIUS}
          />

          <circle
            className="quiz-ring-correct"
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={`${correctLength} ${
              RING_CIRCUMFERENCE - correctLength
            }`}
          />

          <circle
            className="quiz-ring-incorrect"
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={`${incorrectLength} ${
              RING_CIRCUMFERENCE - incorrectLength
            }`}
            strokeDashoffset={incorrectOffset}
          />
        </g>
      </svg>

      <div
        className="quiz-ring-center"
        aria-hidden="true"
      >
        <span className="quiz-ring-percent">
          {scorePercent}%
        </span>
        <span className="quiz-ring-caption">
          score
        </span>
      </div>
    </div>
  );
}

function getOptionLabel(question, optionId) {
  const option = question.options.find(
    (item) => item.id === optionId
  );

  return option
    ? `${option.id}. ${option.text}`
    : "No answer";
}

// Each QuizSession represents one generated quiz.
// The React session key is separate from the database UUID.
function QuizSession({
  questions,
  quizId,
  onNewQuiz,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [savedResult, setSavedResult] = useState(null);

  // A submission is immutable once created.
  // Retries reuse the same answers and idempotency key.
  const submissionRef = useRef(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);

  const questionHeadingRef = useRef(null);
  const resultsHeadingRef = useRef(null);
  const wasShowingResults = useRef(false);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  const selectedAnswer = answers[currentQuestion.id];
  const isAnswered = selectedAnswer !== undefined;

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;

  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion =
    currentIndex === totalQuestions - 1;

  // Immediate local feedback.
  const correctCount = questions.filter(
    (question) =>
      answers[question.id] === question.correctOptionId
  ).length;

  const incorrectCount = answeredCount - correctCount;

  const scorePercent = Math.round(
    (correctCount / totalQuestions) * 100
  );

  // Once saved, the database result becomes authoritative.
  const displayedCorrectCount =
    savedResult?.correctCount ?? correctCount;

  const displayedTotalCount =
    savedResult?.totalQuestions ?? totalQuestions;

  const displayedIncorrectCount =
    displayedTotalCount - displayedCorrectCount;

  const displayedScorePercent =
    savedResult?.scorePercent ?? scorePercent;

  // Protect against state updates after unmounting.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  // Preserve existing keyboard/screen-reader focus behavior.
  useEffect(() => {
    if (showResults) {
      resultsHeadingRef.current?.focus();
    } else if (wasShowingResults.current) {
      questionHeadingRef.current?.focus();
    }

    wasShowingResults.current = showResults;
  }, [showResults]);

  function handleSelectAnswer(optionId) {
    if (showResults) return;

    const questionId = currentQuestion.id;

    setAnswers((previous) => {
      // Lock answers once selected.
      if (previous[questionId] !== undefined) {
        return previous;
      }

      return {
        ...previous,
        [questionId]: optionId,
      };
    });
  }

  function handlePrevious() {
    setCurrentIndex((index) =>
      Math.max(index - 1, 0)
    );
  }

  function handleNext() {
    setCurrentIndex((index) =>
      Math.min(index + 1, totalQuestions - 1)
    );
  }

  // SCRUM-128: Save answers using trusted server-side grading.
  async function saveAttempt() {
    if (
      !quizId ||
      savingRef.current ||
      submissionRef.current?.saved
    ) {
      return;
    }

    // Construct once. Never regenerate the key on retry.
    if (!submissionRef.current) {
      submissionRef.current = {
        quizId,
        idempotencyKey: crypto.randomUUID(),
        answers: questions.map(
          (question, questionIndex) => ({
            questionIndex,
            selectedOptionId: answers[question.id],
          })
        ),
        saved: false,
      };
    }

    const submission = submissionRef.current;
    const generation = generationRef.current;

    savingRef.current = true;
    setSaveStatus("saving");
    setSaveError("");

    try {
      const result = await submitQuizAttempt({
        quizId: submission.quizId,
        idempotencyKey: submission.idempotencyKey,
        answers: submission.answers,
      });

      // Ignore responses from abandoned sessions.
      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        submissionRef.current !== submission
      ) {
        return;
      }

      submission.saved = true;

      setSavedResult(result);
      setSaveStatus("saved");
    } catch (error) {
      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        submissionRef.current !== submission
      ) {
        return;
      }

      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save quiz attempt."
      );

      setSaveStatus("error");
    } finally {
      if (
        generation === generationRef.current &&
        submissionRef.current === submission
      ) {
        savingRef.current = false;
      }
    }
  }

  function handleViewResults() {
    if (!allAnswered || showResults) return;

    setShowResults(true);

    if (!quizId) {
      setSaveStatus("unavailable");
      return;
    }

    void saveAttempt();
  }

  function handleRestart() {
    // Do not abandon an in-flight database operation.
    if (savingRef.current) return;

    generationRef.current += 1;
    submissionRef.current = null;

    setAnswers({});
    setCurrentIndex(0);
    setShowResults(false);

    setSaveStatus("idle");
    setSaveError("");
    setSavedResult(null);
  }

  function handleNewQuiz() {
    if (savingRef.current) return;

    generationRef.current += 1;
    onNewQuiz();
  }

  // Results screen.
  if (showResults) {
    return (
      <section
        className="quiz-page"
        aria-labelledby="quiz-results-title"
      >
        <header className="quiz-results-header">
          <h1
            id="quiz-results-title"
            className="quiz-results-title"
            ref={resultsHeadingRef}
            tabIndex={-1}
          >
            Quiz complete
          </h1>

          <p className="quiz-results-subtitle">
            Here&rsquo;s how you did.
          </p>
        </header>

        <div className="quiz-summary">
          <ScoreRing
            correctCount={displayedCorrectCount}
            incorrectCount={displayedIncorrectCount}
            totalCount={displayedTotalCount}
            scorePercent={displayedScorePercent}
          />

          <dl className="quiz-stats">
            <div className="quiz-stat quiz-stat--correct">
              <dt>
                <CheckIcon />
                Correct answers
              </dt>
              <dd>
                {displayedCorrectCount} / {displayedTotalCount}
              </dd>
            </div>

            <div className="quiz-stat quiz-stat--incorrect">
              <dt>
                <CrossIcon />
                Incorrect answers
              </dt>
              <dd>
                {displayedIncorrectCount} / {displayedTotalCount}
              </dd>
            </div>
          </dl>
        </div>

        <div
          className="quiz-save-status"
          role="status"
          aria-live="polite"
        >
          {saveStatus === "saving" && (
            <p>Saving your quiz results...</p>
          )}

          {saveStatus === "saved" && (
            <p>
              Quiz saved to history.
              {" "}Official score: {savedResult.scorePercent}%
            </p>
          )}

          {saveStatus === "error" && (
            <div>
              <p role="alert">
                {saveError ||
                  "Your quiz could not be saved."}
              </p>

              <button
                type="button"
                className="quiz-nav-button"
                onClick={() => void saveAttempt()}
                disabled={saveStatus === "saving"}
              >
                Retry saving
              </button>
            </div>
          )}

          {saveStatus === "unavailable" && (
            <p>
              Practice quiz only. This attempt cannot
              be saved because no persistent quiz ID
              was available.
            </p>
          )}
        </div>

        <section
          className="quiz-review"
          aria-labelledby="quiz-review-title"
        >
          <h2
            id="quiz-review-title"
            className="quiz-review-title"
          >
            Question review
          </h2>

          <ol className="quiz-review-list">
            {questions.map((question, index) => {
              const chosen = answers[question.id];

              const wasCorrect =
                chosen === question.correctOptionId;

              return (
                <li
                  key={question.id}
                  className={`quiz-review-item ${
                    wasCorrect
                      ? "quiz-review-item--correct"
                      : "quiz-review-item--incorrect"
                  }`}
                >
                  <span
                    className="quiz-review-marker"
                    aria-hidden="true"
                  >
                    {wasCorrect
                      ? <CheckIcon />
                      : <CrossIcon />}
                  </span>

                  <div className="quiz-review-body">
                    <p className="quiz-review-question">
                      {index + 1}. {question.question}
                    </p>

                    <p className="quiz-review-status">
                      {wasCorrect
                        ? "Correct"
                        : "Incorrect"}
                    </p>

                    <p className="quiz-review-answer">
                      Your answer:{" "}
                      {getOptionLabel(question, chosen)}
                    </p>

                    {!wasCorrect && (
                      <p className="quiz-review-answer">
                        Correct answer:{" "}
                        {getOptionLabel(
                          question,
                          question.correctOptionId
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="quiz-results-actions">
          <button
            type="button"
            className="quiz-nav-button quiz-nav-button--primary"
            onClick={handleRestart}
            disabled={saveStatus === "saving"}
          >
            Restart quiz
          </button>

          <button
            type="button"
            className="quiz-nav-button"
            onClick={handleNewQuiz}
            disabled={saveStatus === "saving"}
          >
            New quiz
          </button>
        </div>
      </section>
    );
  }

  // Question-taking screen.
  let feedbackMessage = "";

  if (isAnswered) {
    feedbackMessage =
      selectedAnswer === currentQuestion.correctOptionId
        ? "Correct."
        : `Incorrect. The correct answer is ${currentQuestion.correctOptionId}.`;
  }

  const remainingCount =
    totalQuestions - answeredCount;

  return (
    <section
      className="quiz-page"
      aria-labelledby="quiz-title"
    >
      <h1 id="quiz-title" className="quiz-title">
        Quiz
      </h1>

      <div className="quiz-progress">
        <div className="quiz-progress-meta">
          <span className="quiz-progress-position">
            Question {currentIndex + 1} of {totalQuestions}
          </span>

          <span>
            {answeredCount} of {totalQuestions} answered
          </span>
        </div>

        <div
          className="quiz-progress-bar"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={answeredCount}
          aria-valuetext={`${answeredCount} of ${totalQuestions} questions answered`}
        >
          {questions.map((question, index) => {
            const segmentClasses = [
              "quiz-progress-segment",
            ];

            if (answers[question.id] !== undefined) {
              segmentClasses.push(
                "quiz-progress-segment--answered"
              );
            }

            if (index === currentIndex) {
              segmentClasses.push(
                "quiz-progress-segment--current"
              );
            }

            return (
              <span
                key={question.id}
                className={segmentClasses.join(" ")}
              />
            );
          })}
        </div>
      </div>

      <h2
        id="quiz-question"
        className="quiz-question"
        ref={questionHeadingRef}
        tabIndex={-1}
      >
        {currentQuestion.question}
      </h2>

      <div
        className="quiz-options"
        role="group"
        aria-labelledby="quiz-question"
      >
        {currentQuestion.options.map((option) => {
          const isSelected =
            option.id === selectedAnswer;

          const isCorrect =
            isAnswered &&
            option.id === currentQuestion.correctOptionId;

          const isIncorrect =
            isAnswered &&
            option.id === selectedAnswer &&
            option.id !== currentQuestion.correctOptionId;

          const classes = ["quiz-option"];

          if (isCorrect) {
            classes.push("quiz-option--correct");
          }

          if (isIncorrect) {
            classes.push("quiz-option--incorrect");
          }

          if (isAnswered) {
            classes.push("quiz-option--locked");
          }

          let statusLabel = null;

          if (isIncorrect) {
            statusLabel = "Incorrect";
          } else if (isCorrect) {
            statusLabel = isSelected
              ? "Correct"
              : "Correct answer";
          }

          return (
            <button
              key={option.id}
              type="button"
              className={classes.join(" ")}
              onClick={() =>
                handleSelectAnswer(option.id)
              }
              aria-pressed={isSelected}
              aria-disabled={isAnswered}
            >
              <span
                className="quiz-option-marker"
                aria-hidden="true"
              >
                {isCorrect
                  ? <CheckIcon />
                  : isIncorrect
                    ? <CrossIcon />
                    : option.id}
              </span>

              <span className="quiz-option-text">
                <span className="sr-only">
                  Option {option.id}:{" "}
                </span>
                {option.text}
              </span>

              {statusLabel && (
                <span className="quiz-option-status">
                  {statusLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p
        className={`quiz-feedback${
          isAnswered
            ? selectedAnswer ===
              currentQuestion.correctOptionId
              ? " quiz-feedback--correct"
              : " quiz-feedback--incorrect"
            : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {feedbackMessage}
      </p>

      {isLastQuestion && !allAnswered && (
        <p className="quiz-complete-note">
          Answer the {remainingCount} remaining{" "}
          {remainingCount === 1
            ? "question"
            : "questions"}{" "}
          to see your results.
        </p>
      )}

      <nav
        className="quiz-nav"
        aria-label="Question navigation"
      >
        <button
          type="button"
          className="quiz-nav-button"
          onClick={handlePrevious}
          aria-disabled={isFirstQuestion}
        >
          Previous
        </button>

        {isLastQuestion && allAnswered ? (
          <button
            type="button"
            className="quiz-nav-button quiz-nav-button--primary"
            onClick={handleViewResults}
          >
            View Results
          </button>
        ) : (
          <button
            type="button"
            className="quiz-nav-button quiz-nav-button--primary"
            onClick={handleNext}
            aria-disabled={isLastQuestion}
          >
            Next
          </button>
        )}
      </nav>

      <div className="quiz-extras">
        <button
          type="button"
          className="quiz-nav-button"
          onClick={handleNewQuiz}
        >
          New quiz
        </button>

        <button
          type="button"
          className="quiz-extra-button"
          disabled
        >
          Hint
          <span className="quiz-extra-badge">
            Coming Soon
          </span>
        </button>

        <button
          type="button"
          className="quiz-extra-button"
          disabled
        >
          Chat
          <span className="quiz-extra-badge">
            Coming Soon
          </span>
        </button>
      </div>
    </section>
  );
}

// SCRUM-125: Show setup until a validated quiz exists.
// SCRUM-128: Preserve the backend quiz UUID separately
// from the React session identifier.
function Quiz({ initialQuestions = null }) {
  const [quiz, setQuiz] = useState(
    initialQuestions
      ? {
          sessionId: "initial",
          quizId: null,
          topic: "General",
          questions: initialQuestions,
        }
      : null
  );

  if (!quiz) {
    return (
      <QuizSetup
        onQuizReady={(generatedQuiz) => {
          setQuiz({
            sessionId: crypto.randomUUID(),
            quizId: generatedQuiz.quizId ?? null,
            topic: generatedQuiz.topic ?? "General",
            questions: generatedQuiz.questions,
          });
        }}
      />
    );
  }

  return (
    <QuizSession
      key={quiz.sessionId}
      quizId={quiz.quizId}
      questions={quiz.questions}
      onNewQuiz={() => setQuiz(null)}
    />
  );
}

export default Quiz;
