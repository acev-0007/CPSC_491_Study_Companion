import { useEffect, useRef, useState } from "react";

// Saved flashcard decks (FLASH-DECK-1).
//
// Lists decks, lets the user open one for study, and offers a three-dot
// menu whose only action is "Delete deck". Deleting always goes through a
// confirmation dialog. The parent owns the data: onDeleteDeck(deck) must
// return a promise that rejects if the deck could not be deleted.

function cardCountLabel(count) {
  return `${count} ${count === 1 ? "flashcard" : "flashcards"}`;
}

function SavedDeckList({ decks, onStudyDeck, onDeleteDeck }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [notice, setNotice] = useState(null);

  const listRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);
  // The three-dot button that opened the menu/dialog, so focus can return.
  const triggerRef = useRef(null);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (openMenuId === null) return undefined;

    function handlePointerDown(event) {
      if (!event.target.closest?.(".deck-menu-wrapper")) {
        setOpenMenuId(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (openMenuId === null) return;

    listRef.current
      ?.querySelector('[role="menuitem"]')
      ?.focus();
  }, [openMenuId]);

  // Focus Cancel (the safe choice) when the dialog opens.
  useEffect(() => {
    if (deckToDelete) {
      cancelButtonRef.current?.focus();
    }
  }, [deckToDelete]);

  function handleToggleMenu(event, deck) {
    triggerRef.current = event.currentTarget;
    setNotice(null);
    setOpenMenuId((current) => (current === deck.id ? null : deck.id));
  }

  function handleChooseDelete(deck) {
    setOpenMenuId(null);
    setDeleteError(null);
    setDeckToDelete(deck);
  }

  function closeDialog() {
    if (isDeleting) return;

    setDeckToDelete(null);
    setDeleteError(null);
    // The trigger button may have unmounted if the deck was deleted.
    if (triggerRef.current?.isConnected) {
      triggerRef.current.focus();
    }
  }

  async function handleConfirmDelete() {
    if (!deckToDelete || isDeleting) return;

    const deck = deckToDelete;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteDeck(deck);

      setDeckToDelete(null);
      setNotice(`Deleted "${deck.title}".`);
    } catch (error) {
      setDeleteError(
        error?.message
          ? `Could not delete this deck. ${error.message}`
          : "Could not delete this deck."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDialogKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeDialog();
      return;
    }

    // Keep Tab inside the dialog.
    if (event.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll(
        "button:not(:disabled)"
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="saved-decks">
      <div className="saved-decks-intro">
        <h2>Saved Flashcards</h2>
        <p>Choose a deck to continue studying.</p>
      </div>

      {notice && (
        <p role="status" className="saved-decks-notice">
          {notice}
        </p>
      )}

      {decks.length === 0 ? (
        <p className="saved-decks-empty">
          You have no saved decks yet.
        </p>
      ) : (
        <ul className="saved-decks-list">
          {decks.map((deck) => {
            const menuOpen = openMenuId === deck.id;
            const menuId = `deck-menu-${deck.id}`;

            return (
              <li key={deck.id} className="deck-card">
                <div className="deck-card-info">
                  <h3>{deck.title}</h3>
                  <p>{cardCountLabel(deck.cardCount)}</p>
                </div>

                <button
                  type="button"
                  className="deck-study-btn"
                  aria-label={`Study deck ${deck.title}`}
                  onClick={() => onStudyDeck(deck)}
                >
                  Study Deck
                </button>

                <div className="deck-menu-wrapper">
                  <button
                    type="button"
                    className="deck-menu-btn"
                    aria-label={`Actions for ${deck.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? menuId : undefined}
                    onClick={(event) => handleToggleMenu(event, deck)}
                  >
                    <span aria-hidden="true">⋮</span>
                  </button>

                  {menuOpen && (
                    <div
                      id={menuId}
                      role="menu"
                      className="deck-menu"
                      ref={listRef}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="deck-menu-item deck-menu-item-danger"
                        onClick={() => handleChooseDelete(deck)}
                      >
                        Delete deck
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deckToDelete && (
        <div className="deck-dialog-backdrop">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-deck-title"
            aria-describedby="delete-deck-description"
            className="deck-dialog"
            onKeyDown={handleDialogKeyDown}
          >
            <h2 id="delete-deck-title">
              Delete “{deckToDelete.title}”?
            </h2>

            <p id="delete-deck-description">
              This permanently deletes the deck and all{" "}
              {deckToDelete.cardCount} of its flashcards. This cannot
              be undone.
            </p>

            {deleteError && (
              <p role="alert" className="deck-dialog-error">
                {deleteError}
              </p>
            )}

            <div className="deck-dialog-actions">
              <button
                type="button"
                ref={cancelButtonRef}
                onClick={closeDialog}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="deck-dialog-confirm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete deck"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SavedDeckList;