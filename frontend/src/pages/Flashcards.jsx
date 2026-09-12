import { useState } from "react";

import mockFlashcards from "../data/mockFlashcards";
import "../components/Flashcards.css";

function Flashcards() {
  const [isFlipped, setIsFlipped] = useState(false);
  const card = mockFlashcards[0];

  function handleFlip() {
    setIsFlipped((prev) => !prev);
  }

  return (
    <section className="flashcards-page">
      <h1>Flashcards</h1>

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
    </section>
  );
}
 
 export default Flashcards;