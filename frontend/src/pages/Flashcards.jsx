import { useRef, useState } from "react";

import {
  saveGeneratedFlashcards,
} from "../services/flashcardPersistence";
import { getFlashcards } from "../data/flashcardSource";
import { deleteDeck, listDecks } from "../services/flashcardDecks";
import { adaptGeneratedFlashcards } from "../data/generatedFlashcardAdapter";
import { generateFlashcards } from "../services/flashcardGeneration";
import StudyMaterialInput from "../components/StudyMaterialInput";
import SavedDeckList from "../components/SavedDeckList";
import "../components/Flashcards.css";

function Flashcards() {
  // Saved and generated decks remain separate.
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [deckTitle, setDeckTitle] = useState("");
  // Saved decks (FLASH-DECK-1): the list, and the cards of the opened deck.
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [generatedCards, setGeneratedCards] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Ignores responses from a load that has since been superseded.
  const loadRequestRef = useRef(0);

  // FLASH-UI-4: same guard for AI generation. A generation response that
  // arrives after the student has left the generate screen is discarded
  // instead of pulling them into a generated deck they did not ask for.
  const generateRequestRef = useRef(0);

  const [view, setView] = useState("home");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [draftFront, setDraftFront] = useState("");
  const [draftBack, setDraftBack] = useState("");

  const [generationNotice, setGenerationNotice] = useState(null);

  const isGeneratedDeck = view === "generated";
  const cards = isGeneratedDeck
  ? (generatedCards ?? [])
  : savedCards;

  const totalCards = cards.length;
  const card = cards[currentIndex];

  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex === totalCards - 1;

  // The viewer can edit either deck without mixing their data.

  function handleBackToHome() {
  loadRequestRef.current += 1;
  generateRequestRef.current += 1;
  setView("home");
  setIsLoading(false);
  setLoadError(null);
  setGenerationNotice(null);
  resetStudySession();
}

function handleBackToSavedDecks() {
  loadRequestRef.current += 1;
  setView("saved");
  setIsLoading(false);
  setLoadError(null);
  setActiveDeck(null);
  setSavedCards([]);
  resetStudySession();
}

function handleOpenGeneration() {
  // FLASH-UI-4: invalidate any in-flight deck load so a late response
  // cannot overwrite state while the generate screen is showing.
  loadRequestRef.current += 1;
  generateRequestRef.current += 1;
  setIsLoading(false);
  setLoadError(null);
  setView("generate");
  setGenerationNotice(null);
  resetStudySession();
}

async function handleShowSavedCards() {
  const requestId = ++loadRequestRef.current;
  generateRequestRef.current += 1;

  setView("saved");
  setGenerationNotice(null);
  resetStudySession();

  setIsLoading(true);
  setLoadError(null);

  try {
    const loaded = await listDecks();

    if (requestId !== loadRequestRef.current) return;

    setDecks(loaded);
  } catch {
    if (requestId !== loadRequestRef.current) return;

    setLoadError("Could not load saved flashcards.");
  } finally {
    if (requestId === loadRequestRef.current) {
      setIsLoading(false);
    }
  }
}

async function handleStudyDeck(deck) {
  const requestId = ++loadRequestRef.current;

  setActiveDeck(deck);
  setSavedCards([]);
  setView("deck");
  resetStudySession();

  setIsLoading(true);
  setLoadError(null);

  try {
    const loaded = await getFlashcards({ topicId: deck.id });

    if (requestId !== loadRequestRef.current) return;

    setSavedCards(loaded);
  } catch {
    if (requestId !== loadRequestRef.current) return;

    setLoadError("Could not load this deck's flashcards.");
  } finally {
    if (requestId === loadRequestRef.current) {
      setIsLoading(false);
    }
  }
}

// Rejects on failure so SavedDeckList can keep the deck visible and
// show the error. The database cascade removes the deck's flashcards.
async function handleDeleteDeck(deck) {
  await deleteDeck(deck.id);

  setDecks((previous) =>
    previous.filter((item) => item.id !== deck.id)
  );
}

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

  /**
   * SCRUM-123:
   * Consume the structured response from SCRUM-122.
   * Validate cards before displaying them.
   */
  async function handleGenerate(studyText) {
  setGenerationNotice(null);

  const requestId = ++generateRequestRef.current;

  const result = await generateFlashcards(studyText);

  // Superseded or abandoned while waiting: ignore the response.
  if (requestId !== generateRequestRef.current) return;

  const { flashcards, rejectedCount } =
    adaptGeneratedFlashcards(result.flashcards);

  if (flashcards.length === 0) {
    setGenerationNotice(
      "No usable flashcards were generated. " +
      "Try adding more detailed notes."
    );
    return;
  }

  setGeneratedCards(flashcards);
  setDeckTitle("");
  setSaveResult(null);
  resetStudySession();

  const count = flashcards.length;

  setGenerationNotice(
    rejectedCount > 0
      ? `Generated ${count} flashcards. ${rejectedCount} invalid cards skipped.`
      : `Generated ${count} flashcards.`
  );

  // Hide the input and open the generated deck.
  setView("generated");
}




async function handleSaveDeck() {
  if (
    isSaving ||
    !generatedCards?.length ||
    saveResult?.status === "success"
  ) {
    return;
  }

  setIsSaving(true);
  setSaveResult(null);

  try {
    const result = await saveGeneratedFlashcards({
      title: deckTitle,
      cards: generatedCards,
    });

    setSaveResult(result);
  } catch {
    setSaveResult({
      status: "failed",
      topicId: null,
      error:
        "The save result could not be confirmed. " +
        "Check your saved decks before trying again.",
    });
  } finally {
    setIsSaving(false);
  }
}



  
return (
  <section className="flashcards-page">
    <h1>Flashcards</h1>

    {view === "home" && (
      <div className="flashcards-home">
        <h2>Study Flashcards</h2>
        <p>
          Generate new flashcards from your notes or
          continue studying saved cards.
        </p>

        <div className="flashcards-home-actions">
          <button
            type="button"
            className="flashcards-primary-btn"
            onClick={handleOpenGeneration}
          >
            Generate New Flashcards
          </button>

          <button
            type="button"
            className="flashcards-secondary-btn"
            onClick={handleShowSavedCards}
          >
            Study Saved Flashcards
          </button>
        </div>
      </div>
    )}

    {view === "generate" && (
      <>
        <button
          type="button"
          className="flashcards-back-btn"
          onClick={handleBackToHome}
        >
          ← Back
        </button>

        <StudyMaterialInput onGenerate={handleGenerate} />

        {generationNotice && (
          <p
            role="status"
            className="flashcards-generation-notice"
          >
            {generationNotice}
          </p>
        )}
      </>
    )}

    {view === "saved" && (
      <>
        <div className="flashcards-session-header">
          <button
            type="button"
            className="flashcards-back-btn"
            onClick={handleBackToHome}
          >
            ← Back to Flashcards
          </button>
        </div>

        {isLoading ? (
          <p role="status" className="flashcards-state-message">
            Loading saved decks...
          </p>
        ) : loadError ? (
          <p role="alert" className="flashcards-state-message">
            {loadError}
          </p>
        ) : (
          <SavedDeckList
            decks={decks}
            onStudyDeck={handleStudyDeck}
            onDeleteDeck={handleDeleteDeck}
          />
        )}
      </>
    )}

    {(view === "generated" || view === "deck") && (
      <>
        <div className="flashcards-session-header">
          <button
            type="button"
            className="flashcards-back-btn"
            onClick={
              isGeneratedDeck
                ? handleBackToHome
                : handleBackToSavedDecks
            }
          >
            {isGeneratedDeck
              ? "← Back to Flashcards"
              : "← Back to Saved Decks"}
          </button>

          <span className="flashcards-deck-type">
            {isGeneratedDeck
              ? "AI-generated deck"
              : activeDeck?.title ?? "Saved deck"}
          </span>
        </div>

        {isGeneratedDeck && generationNotice && (
          <p
            role="status"
            className="flashcards-generation-notice"
          >
            {generationNotice}
          </p>
        )}


{isGeneratedDeck && totalCards > 0 && (
  <div className="flashcards-save-panel">
    <label htmlFor="flashcards-deck-title">
      Deck title
    </label>

    <input
      id="flashcards-deck-title"
      type="text"
      maxLength={255}
      value={deckTitle}
      onChange={(event) => setDeckTitle(event.target.value)}
      placeholder="e.g. Operating Systems - Chapter 3"
      disabled={isSaving || saveResult?.status === "success"}
    />

    <button
      type="button"
      className="flashcards-primary-btn"
      onClick={handleSaveDeck}
      disabled={
        isSaving ||
        !deckTitle.trim() ||
        saveResult?.status === "success" ||
        saveResult?.status === "partial" ||
        (saveResult?.status === "failed" && !!saveResult.topicId)
      }
    >
      {isSaving ? "Saving..." : "Save Flashcards"}
    </button>

    {saveResult?.status === "success" && (
      <p role="status">
        Successfully saved {saveResult.savedCards.length} flashcards.
      </p>
    )}

    {saveResult?.status === "partial" && (
      <p role="alert">
        Saved {saveResult.savedCards.length} flashcards.
        Some saves failed or could not be confirmed.
        Check your saved flashcards before retrying.
      </p>
    )}

    {saveResult?.status === "failed" && (
      <p role="alert">
        {saveResult.error || "Could not save flashcards."}
        {saveResult.topicId
          ? " Check your saved flashcards before retrying."
          : ""}
      </p>
    )}
  </div>
)}


        {view === "deck" && isLoading ? (
          <p role="status" className="flashcards-state-message">
            Loading flashcards...
          </p>
        ) : view === "deck" && loadError ? (
          <p role="alert" className="flashcards-state-message">
            {loadError}
          </p>
        ) : totalCards === 0 ? (
          <p className="flashcards-state-message">
            No flashcards are available yet.
          </p>
        ) : (
          <>
            <p
              className="flashcards-progress"
              aria-live="polite"
            >
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

                <p className="flashcard-edit-note">
                  Edits apply to this study session only and are not
                  saved to your deck.
                </p>

                <div className="flashcard-edit-actions">
                  <button
                    type="submit"
                    className="flashcards-primary-btn"
                  >
                    Apply Changes
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
              <button
                type="button"
                className="flashcard"
                aria-pressed={isFlipped}
                onClick={handleFlip}
              >
                <span className="flashcard-side">
                  {isFlipped ? "Answer" : "Question"}
                </span>

                <span className="flashcard-text">
                  {isFlipped ? card.back : card.front}
                </span>

                <span className="flashcard-hint">
                  Click to flip
                </span>
              </button>
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
        )}
      </>
    )}
  </section>
);

}

export default Flashcards;