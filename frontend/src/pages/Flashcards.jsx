import { useEffect, useState } from "react";

import { getFlashcards } from "../data/flashcardSource";
import { generateFlashcards } from "../services/flashcardGeneration";
import StudyMaterialInput from "../components/StudyMaterialInput";
import "../components/Flashcards.css";

function Flashcards() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftFront, setDraftFront] = useState("");
  const [draftBack, setDraftBack] = useState("");
  const [generationNotice, setGenerationNotice] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getFlashcards()
      .then((loaded) => {
        if (cancelled) return;
        setCards(loaded);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Could not load flashcards.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        index === currentIndex ? { ...c, front: draftFront, back: draftBack } : c
      )
    );
    setIsFlipped(false);
    setIsEditing(false);
  }

  // SCRUM-121: generation is still a stub, so no cards are produced yet.
  // SCRUM-122/123 will replace the notice with validated, displayed cards.
  async function handleGenerate(studyText) {
  setGenerationNotice(null);

  const result = await generateFlashcards(studyText);

  if (result.isStub) {
    setGenerationNotice(
      "AI flashcard generation is not connected yet. " +
      "Your study notes were validated successfully."
    );
    return;
  }

  // SCRUM-122/123:
  // Validate and display generated cards here.
}

  // Rendered in every state so students can always enter notes. It sits at the
  // same position in each branch below, so typed text survives the initial load.
  const generationPanel = (
    <>
      <StudyMaterialInput onGenerate={handleGenerate} />
      {generationNotice && (
        <p role="status" className="flashcards-generation-notice">
          {generationNotice}
        </p>
      )}
    </>
  );

  if (isLoading) {
    return (
      <section className="flashcards-page">
        <h1>Flashcards</h1>
        {generationPanel}
        <p>Loading flashcards...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="flashcards-page">
        <h1>Flashcards</h1>
        {generationPanel}
        <p role="alert">{loadError}</p>
      </section>
    );
  }

  if (totalCards === 0) {
    return (
      <section className="flashcards-page">
        <h1>Flashcards</h1>
        {generationPanel}
        <p>No flashcards are available yet.</p>
      </section>
    );
  }

  // Saved cards stay out of the way until the student asks for them, so the
  // page opens on the generation workflow. Generating never reveals them.
  if (!showSaved) {
    return (
      <section className="flashcards-page">
        <h1>Flashcards</h1>
        {generationPanel}
        <div className="flashcards-saved">
          <h2>Existing Flashcards</h2>
          <p>Continue studying cards already saved to your account.</p>
          <button
            type="button"
            className="flashcards-primary-btn"
            onClick={() => setShowSaved(true)}
          >
            Study Saved Flashcards
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flashcards-page">
      <h1>Flashcards</h1>
      {generationPanel}
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