import { useState } from "react";

import mockFlashcards from "../data/mockFlashcards";
import "../components/Flashcards.css";

function Flashcards() {
  const [cards, setCards] = useState(mockFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftFront, setDraftFront] = useState("");
  const [draftBack, setDraftBack] = useState("");

  const totalCards = cards.length;
  const card = cards[currentIndex];
  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex === totalCards - 1;

  function handleFlip() {
    if (isEditing) return;
    setIsFlipped((prev) => !prev);
  }

  function handlePrevious() {
    if (isFirstCard || isEditing) return;
    setCurrentIndex((prev) => prev - 1);
    setIsFlipped(false);
  }

  function handleNext() {
    if (isLastCard || isEditing) return;
    setCurrentIndex((prev) => prev + 1);
    setIsFlipped(false);
  }

  function handleStartEdit() {
    setDraftFront(card.front);
    setDraftBack(card.back);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleSaveEdit(event) {
    event.preventDefault();

    setCards((prev) =>
      prev.map((c, index) =>
        index === currentIndex
          ? { ...c, front: draftFront, back: draftBack }
          : c
      )
    );
    setIsFlipped(false);
    setIsEditing(false);
  }

  return (
    <section className="flashcards-page">
      <h1>Flashcards</h1>
      <p className="flashcards-progress">
        Card {currentIndex + 1} of {totalCards}
      </p>

      {isEditing ? (
        <form className="flashcard-edit-form" onSubmit={handleSaveEdit}>
          <label htmlFor="flashcard-front-input">Front</label>
          <textarea
            id="flashcard-front-input"
            value={draftFront}
            onChange={(event) => setDraftFront(event.target.value)}
            rows={3}
            required
          />

          <label htmlFor="flashcard-back-input">Back</label>
          <textarea
            id="flashcard-back-input"
            value={draftBack}
            onChange={(event) => setDraftBack(event.target.value)}
            rows={3}
            required
          />

          <div className="flashcard-edit-actions">
            <button type="submit" className="flashcards-primary-btn">
              Save
            </button>
            <button type="button" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div
          className="flashcard"
          role="button"
          tabIndex={0}
          aria-pressed={isFlipped}
          onClick={handleFlip}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleFlip();
            }
          }}
        >
          <p>{isFlipped ? card.back : card.front}</p>
          <span className="flashcard-hint">Click to flip</span>
        </div>
      )}

      {!isEditing && (
        <>
          <div className="flashcards-controls">
            <button type="button" onClick={handlePrevious} disabled={isFirstCard}>
              Previous
            </button>
            <button type="button" onClick={handleNext} disabled={isLastCard}>
              Next
            </button>
          </div>

          <button type="button" className="flashcard-edit-btn" onClick={handleStartEdit}>
            Edit flashcard
          </button>
        </>
      )}
    </section>
  );
}

export default Flashcards;