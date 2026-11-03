import { useState } from "react";

import { mockQuiz } from "../data/mockQuiz";
import "./Quiz.css";

// SCRUM-124: multiple-choice quiz UI backed by mock data.
// No API calls, submission, or persistence; answers live in component state.

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
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

function Quiz() {
  const [currentIndex, setCurrentIndex] = useState(0);
  // { [questionId]: selectedOptionId }
  const [answers, setAnswers] = useState({});

  // Everything below is derived from the two state variables above.
  const totalQuestions = mockQuiz.length;
  const currentQuestion = mockQuiz[currentIndex];
  const selectedAnswer = answers[currentQuestion.id];
  const isAnswered = selectedAnswer !== undefined;
  const answeredCount = Object.keys(answers).length;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  function handleSelectAnswer(optionId) {
    const questionId = currentQuestion.id;

    setAnswers((previous) => {
      // Answers are locked once chosen.
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
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  function handleNext() {
    setCurrentIndex((index) => Math.min(index + 1, totalQuestions - 1));
  }

  let feedbackMessage = "";
  if (isAnswered) {
    feedbackMessage =
      selectedAnswer === currentQuestion.correctOptionId
        ? "Correct."
        : `Incorrect. The correct answer is ${currentQuestion.correctOptionId}.`;
  }

  return (
    <section className="quiz-page" aria-labelledby="quiz-title">
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
          {mockQuiz.map((question, index) => {
            const segmentClasses = ["quiz-progress-segment"];
            if (answers[question.id] !== undefined) {
              segmentClasses.push("quiz-progress-segment--answered");
            }
            if (index === currentIndex) {
              segmentClasses.push("quiz-progress-segment--current");
            }
            return <span key={question.id} className={segmentClasses.join(" ")} />;
          })}
        </div>
      </div>

      <h2 id="quiz-question" className="quiz-question">
        {currentQuestion.question}
      </h2>

      <div className="quiz-options" role="group" aria-labelledby="quiz-question">
        {currentQuestion.options.map((option) => {
          const isSelected = option.id === selectedAnswer;
          const isCorrect =
            isAnswered && option.id === currentQuestion.correctOptionId;
          const isIncorrect =
            isAnswered &&
            option.id === selectedAnswer &&
            option.id !== currentQuestion.correctOptionId;

          const classes = ["quiz-option"];
          if (isCorrect) classes.push("quiz-option--correct");
          if (isIncorrect) classes.push("quiz-option--incorrect");
          if (isAnswered) classes.push("quiz-option--locked");

          // Feedback is never color alone: icon + visible text label as well.
          let statusLabel = null;
          if (isIncorrect) statusLabel = "Incorrect";
          else if (isCorrect) statusLabel = isSelected ? "Correct" : "Correct answer";

          return (
            <button
              key={option.id}
              type="button"
              className={classes.join(" ")}
              onClick={() => handleSelectAnswer(option.id)}
              aria-pressed={isSelected}
              // aria-disabled (not `disabled`) keeps locked options focusable,
              // so keyboard and screen-reader users can still read the feedback.
              aria-disabled={isAnswered}
            >
              <span className="quiz-option-marker" aria-hidden="true">
                {isCorrect ? <CheckIcon /> : isIncorrect ? <CrossIcon /> : option.id}
              </span>
              <span className="quiz-option-text">
                <span className="sr-only">Option {option.id}: </span>
                {option.text}
              </span>
              {statusLabel && (
                <span className="quiz-option-status">{statusLabel}</span>
              )}
            </button>
          );
        })}
      </div>

      <p
        className={`quiz-feedback${
          isAnswered
            ? selectedAnswer === currentQuestion.correctOptionId
              ? " quiz-feedback--correct"
              : " quiz-feedback--incorrect"
            : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {feedbackMessage}
      </p>

      <nav className="quiz-nav" aria-label="Question navigation">
        <button
          type="button"
          className="quiz-nav-button"
          onClick={handlePrevious}
          aria-disabled={isFirstQuestion}
        >
          Previous
        </button>
        <button
          type="button"
          className="quiz-nav-button quiz-nav-button--primary"
          onClick={handleNext}
          aria-disabled={isLastQuestion}
        >
          Next
        </button>
      </nav>

      <div className="quiz-extras">
        <button type="button" className="quiz-extra-button" disabled>
          Hint
          <span className="quiz-extra-badge">Coming Soon</span>
        </button>
        <button type="button" className="quiz-extra-button" disabled>
          Chat
          <span className="quiz-extra-badge">Coming Soon</span>
        </button>
      </div>
    </section>
  );
}

export default Quiz;