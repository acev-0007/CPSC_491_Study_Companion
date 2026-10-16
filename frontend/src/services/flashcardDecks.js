// Saved flashcard decks (FLASH-DECK-1).
//
// A "deck" is a topic row owned by the signed-in user. Cards for one deck
// are loaded with getFlashcards({ topicId }) in data/flashcardSource.js.
// Deleting a deck is one request: the database cascades to its flashcards,
// so the client never deletes cards one by one.

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDeck(topic) {
  if (
    !topic ||
    typeof topic.id !== "string" ||
    !UUID_REGEX.test(topic.id) ||
    typeof topic.title !== "string" ||
    topic.title.trim() === ""
  ) {
    return null;
  }

  return {
    id: topic.id,
    title: topic.title,
    createdAt: typeof topic.created_at === "string" ? topic.created_at : null,
    cardCount: Number.isInteger(topic.card_count) ? topic.card_count : 0,
  };
}

/**
 * Lists the signed-in user's saved decks, newest first.
 * Malformed entries are dropped instead of breaking the list.
 *
 * @returns {Promise<Array<{id, title, createdAt, cardCount}>>}
 */
export async function listDecks({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/api/topics", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to load saved decks");
  }

  const data = await response.json().catch(() => null);

  if (!Array.isArray(data?.topics)) {
    return [];
  }

  return data.topics.map(normalizeDeck).filter(Boolean);
}

/**
 * Permanently deletes a deck and (via database cascade) its flashcards.
 * Resolves on success; rejects with an Error carrying .status otherwise.
 */
export async function deleteDeck(deckId, { fetchImpl = fetch } = {}) {
  if (typeof deckId !== "string" || !UUID_REGEX.test(deckId)) {
    throw new Error("Invalid deck ID.");
  }

  const response = await fetchImpl(`/api/topics/${deckId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(
      data?.error ?? `Failed to delete deck (${response.status})`
    );
    error.status = response.status;
    throw error;
  }
}