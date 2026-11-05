// Saves a generated deck: one topic, then one card at a time.
// Sequential saves make partial failures easy to report accurately.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function postJson(path, body, fetchImpl) {
    
const response = await fetchImpl(path, {    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const err = new Error(data?.error ?? `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

function cleanCards(cards) {
  return (Array.isArray(cards) ? cards : [])
    .map((c) => ({
      front: typeof c?.front === "string" ? c.front.trim() : "",
      back: typeof c?.back === "string" ? c.back.trim() : "",
    }))
    .filter((c) => c.front && c.back);
}

/**
 * @param {object}   args
 * @param {string}   args.title
 * @param {Array}    args.cards            [{front, back}]
 * @param {string=}  args.sourceText
 * @param {string=}  args.topicId          pass on retry to reuse the topic
 * @param {Function=} args.fetchImpl       injectable for tests
 * @returns {{status, topicId, savedCards, failedCards, error?}}
 *   status: "success" | "partial" | "failed"
 */
export async function saveGeneratedFlashcards({
  title,
  cards,
  sourceText,
  topicId,
  fetchImpl = fetch,
}) {
  const valid = cleanCards(cards);

  if (
  typeof title !== "string" ||
  title.trim().length === 0 ||
  title.trim().length > 255 ||
  valid.length === 0
) {
    return {
      status: "failed",
      topicId: topicId ?? null,
      savedCards: [],
      failedCards: valid,
      error: "A title and at least one complete flashcard are required.",
    };
  }

  let id = topicId ?? null;
  if (id !== null && !UUID_REGEX.test(id)) {
  return {
    status: "failed",
    topicId: null,
    savedCards: [],
    failedCards: valid,
    error: "Invalid topic ID.",
  };
}

  if (!id) {
    try {
      const topic = await postJson(
        "/api/topics",
        { title: title.trim(), source_text: sourceText ?? null},
        fetchImpl
      );
      if (
  typeof topic?.id !== "string" ||
  !UUID_REGEX.test(topic.id)
) {
  throw new Error("Topic creation returned an invalid ID.");
}

id = topic.id;
    } catch (err) {
      return {
        status: "failed",
        topicId: null,
        savedCards: [],
        failedCards: valid,
        error: err.message,
      };
    }
  }

  const savedCards = [];

  for (let i = 0; i < valid.length; i++) {
    try {
      const saved = await postJson(
        "/api/flashcards",
        { topic_id: id, front: valid[i].front, back: valid[i].back },
        fetchImpl
      );if (
  !saved ||
  typeof saved.id !== "string" ||
  !UUID_REGEX.test(saved.id) ||
  saved.topic_id !== id ||
  saved.front !== valid[i].front ||
  saved.back !== valid[i].back
) {
  throw new Error("Flashcard save returned invalid data.");
}
      savedCards.push(saved);
    } catch (err) {
      // Stop at first failure; only the remaining cards are unsaved.
      return {
        status: savedCards.length > 0 ? "partial" : "failed",
        topicId: id,
        savedCards,
        failedCards: valid.slice(i),
        error: err.message,
      };
    }
  }

  return { status: "success", topicId: id, savedCards, failedCards: [] };
}