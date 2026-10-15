
import { useEffect, useState } from "react";

import { getFlashcards } from "../data/flashcardSource";
import { adaptGeneratedFlashcards } from "../data/generatedFlashcardAdapter";
import { generateFlashcards } from "../services/flashcardGeneration";
import StudyMaterialInput from "../components/StudyMaterialInput";
import "../components/Flashcards.css";

function Flashcards() {
  // Saved and generated decks remain separate.
  const [savedCards, setSavedCards] = useState([]);
  const [generatedCards, setGeneratedCards] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [showSaved, setShowSaved] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [draftFront, setDraftFront] = useState("");
  const [draftBack, setDraftBack] = useState("");

  const [generationNotice, setGenerationNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getFlashcards()
      .then((loaded) => {
        if (cancelled) return;

        setSavedCards(loaded);
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

  const isGeneratedDeck = generatedCards !== null;
  const cards = isGeneratedDeck ? generatedCards : savedCards;

  const totalCards = cards.length;
  const card = cards[currentIndex];

  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex === totalCards - 1;

  // The viewer can edit either deck without mixing their data.
  function updateActiveCards(updater) {
    if (isGeneratedDeck) {
      setGeneratedCards(updater);
    } else {
      setSavedCards(updater);
    }
  }

  function resetStudySession() {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsEditing(false);
  }

  function handleFlip() {
    if (isEditing) return;

    setIsFlipped((previous) => !previous);
  }

  function handlePrevious() {
    if (isFirstCard || isEditing) return;

    setCurrentIndex((previous) => previous - 1);
    setIsFlipped(false);
  }

  function handleNext() {
    if (isLastCard || isEditing) return;

    setCurrentIndex((previous) => previous + 1);
    setIsFlipped(false);
  }

  function handleStartEdit() {
    if (!card) return;

    setDraftFront(card.front);
    setDraftBack(card.back);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleSaveEdit(event) {
    event.preventDefault();

    updateActiveCards((previous) =>
      previous.map((item, index) =>
        index === currentIndex
          ? {
              ...item,
              front: draftFront,
              back: draftBack,
            }
          : item
      )
    );

    setIsFlipped(false);
    setIsEditing(false);
  }

  function handleShowSavedCards() {
    setGeneratedCards(null);
    setGenerationNotice(null);
    setShowSaved(true);
    resetStudySession();
  }

  /**
   * SCRUM-123:
   * Consume the structured response from SCRUM-122.
   * Validate cards before displaying them.
   */
  async function handleGenerate(studyText) {
    setGenerationNotice(null);

    const result = await generateFlashcards(studyText);

    const { flashcards, rejectedCount } =
      adaptGeneratedFlashcards(result.flashcards);

    if (flashcards.length === 0) {
      setGenerationNotice(
        "No usable flashcards were generated from those notes. " +
        "Try adding more detail and generating again."
      );
      return;
    }

    setGeneratedCards(flashcards);
    setShowSaved(false);
    resetStudySession();

    const count =
      `${flashcards.length} flashcard` +
      (flashcards.length === 1 ? "" : "s");

    if (rejectedCount > 0) {
      setGenerationNotice(
        `Generated ${count}. ` +
        `${rejectedCount} invalid card` +
        (rejectedCount === 1 ? " was" : "s were") +
        " skipped."
      );
    } else {
      setGenerationNotice(`Generated ${count}.`);
    }
  }

  const showViewer =
    totalCards > 0 &&
    (isGeneratedDeck || showSaved);

  return (
    <section className="flashcards-page">
      <h1>Flashcards</h1>

      <StudyMaterialInput onGenerate={handleGenerate} />

      {generationNotice && (
        <p
          role="status"
          className="flashcards-generation-notice"
        >
          {generationNotice}
        </p>
      )}

      {!isGeneratedDeck && isLoading ? (
        <p>Loading flashcards...</p>
      ) : !isGeneratedDeck && loadError ? (
        <p role="alert">{loadError}</p>
      ) : showViewer ? (
        <>
          {isGeneratedDeck && (
            <div className="flashcards-deck-label">
              <span>AI-generated deck</span>

              <button
                type="button"
                onClick={handleShowSavedCards}
              >
                Back to saved cards
              </button>
            </div>
          )}

          <p className="flashcards-progress">
            Card {currentIndex + 1} of {totalCards}
          </p>

          {isEditing ? (
            <form
              className="flashcard-edit-form"
              onSubmit={handleSaveEdit}
            >
              <label htmlFor="flashcard-front-input">
                Front
              </label>

              <textarea
                id="flashcard-front-input"
                value={draftFront}
                onChange={(event) =>
                  setDraftFront(event.target.value)
                }
                rows={3}
                required
              />

              <label htmlFor="flashcard-back-input">
                Back
              </label>

              <textarea
                id="flashcard-back-input"
                value={draftBack}
                onChange={(event) =>
                  setDraftBack(event.target.value)
                }
                rows={3}
                required
              />

              <div className="flashcard-edit-actions">
                <button
                  type="submit"
                  className="flashcards-primary-btn"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                >
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
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  handleFlip();
                }
              }}
            >
              <p>{isFlipped ? card.back : card.front}</p>

              <span className="flashcard-hint">
                Click to flip
              </span>
            </div>
          )}

          {!isEditing && (
            <>
              <div className="flashcards-controls">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={isFirstCard}
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isLastCard}
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                className="flashcard-edit-btn"
                onClick={handleStartEdit}
              >
                Edit flashcard
              </button>
            </>
          )}
        </>
      ) : !isGeneratedDeck && totalCards > 0 ? (
        <div className="flashcards-saved">
          <h2>Existing Flashcards</h2>

          <p>
            Continue studying cards already saved
            to your account.
          </p>

          <button
            type="button"
            className="flashcards-primary-btn"
            onClick={handleShowSavedCards}
          >
            Study Saved Flashcards
          </button>
        </div>
      ) : (
        <p>No flashcards are available yet.</p>
      )}
    </section>
  );
}

export default Flashcards;
