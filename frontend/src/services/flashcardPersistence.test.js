import { describe, it, expect, vi } from "vitest";

import { saveGeneratedFlashcards } from "./flashcardPersistence";

const TOPIC_ID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const makeCards = (n) =>
  Array.from({ length: n }, (_, i) => ({
    front: `Front ${i + 1}`,
    back: `Back ${i + 1}`,
  }));

// Routes by URL. `failCardNumbers` are 1-based positions among card POSTs.
function makeFetch({ topicStatus = 201, failCardNumbers = [], networkFailCard } = {}) {
  let cardCalls = 0;

  return vi.fn(async (url, options) => {
    if (url.endsWith("/api/topics")) {
      return topicStatus === 201
        ? jsonResponse(201, { id: TOPIC_ID, title: "T" })
        : jsonResponse(topicStatus, { error: "Failed to create topic." });
    }

    cardCalls += 1;

    if (networkFailCard === cardCalls) {
      throw new TypeError("Failed to fetch");
    }
    if (failCardNumbers.includes(cardCalls)) {
      return jsonResponse(500, { error: "Failed to create flashcard" });
    }

    const body = JSON.parse(options.body);
    return jsonResponse(201, { id: `00000000-0000-4000-8000-${String(cardCalls).padStart(12, "0")}`, ...body });
  });
}

const callsTo = (fetchMock, suffix) =>
  fetchMock.mock.calls.filter(([url]) => url.endsWith(suffix));

describe("saveGeneratedFlashcards", () => {
  it("saves the topic, then every card, and reports success", async () => {
    const fetchImpl = makeFetch();

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(3),
      fetchImpl,
    });

    expect(result.status).toBe("success");
    expect(result.topicId).toBe(TOPIC_ID);
    expect(result.savedCards).toHaveLength(3);
    expect(result.failedCards).toEqual([]);
    expect(callsTo(fetchImpl, "/api/topics")).toHaveLength(1);
    expect(callsTo(fetchImpl, "/api/flashcards")).toHaveLength(3);
  });

  it("sends cookies and never sends a user_id", async () => {
    const fetchImpl = makeFetch();

    await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(1),
      fetchImpl,
    });

    for (const [, options] of fetchImpl.mock.calls) {
      expect(options.credentials).toBe("same-origin");
      expect(JSON.parse(options.body)).not.toHaveProperty("user_id");
    }
  });

  it("fails without saving cards when topic creation fails", async () => {
    const fetchImpl = makeFetch({ topicStatus: 500 });

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(3),
      fetchImpl,
    });

    expect(result.status).toBe("failed");
    expect(result.topicId).toBeNull();
    expect(result.savedCards).toEqual([]);
    expect(result.failedCards).toHaveLength(3);
    expect(callsTo(fetchImpl, "/api/flashcards")).toHaveLength(0);
  });

  it("reports a partial save when card 3 of 5 fails", async () => {
    const fetchImpl = makeFetch({ failCardNumbers: [3] });

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(5),
      fetchImpl,
    });

    expect(result.status).toBe("partial");
    expect(result.topicId).toBe(TOPIC_ID);
    expect(result.savedCards).toHaveLength(2);
    expect(result.failedCards.map((c) => c.front)).toEqual([
      "Front 3",
      "Front 4",
      "Front 5",
    ]);
    // Stops at the first failure instead of hammering the API.
    expect(callsTo(fetchImpl, "/api/flashcards")).toHaveLength(3);
  });

  it("reports failed (not partial) when the first card fails", async () => {
    const fetchImpl = makeFetch({ failCardNumbers: [1] });

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(2),
      fetchImpl,
    });

    expect(result.status).toBe("failed");
    expect(result.topicId).toBe(TOPIC_ID);
    expect(result.failedCards).toHaveLength(2);
  });

  it("treats a network error mid-save as a partial failure", async () => {
    const fetchImpl = makeFetch({ networkFailCard: 2 });

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(3),
      fetchImpl,
    });

    expect(result.status).toBe("partial");
    expect(result.savedCards).toHaveLength(1);
    expect(result.failedCards).toHaveLength(2);
  });

  it("retry reuses the topic and saves only the failed cards", async () => {
    const fetchImpl = makeFetch();

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: makeCards(5).slice(2),
      topicId: TOPIC_ID,
      fetchImpl,
    });

    expect(result.status).toBe("success");
    expect(result.savedCards).toHaveLength(3);
    expect(callsTo(fetchImpl, "/api/topics")).toHaveLength(0);
    expect(callsTo(fetchImpl, "/api/flashcards")).toHaveLength(3);
  });

  it("rejects a blank title without calling the API", async () => {
    const fetchImpl = makeFetch();

    const result = await saveGeneratedFlashcards({
      title: "   ",
      cards: makeCards(2),
      fetchImpl,
    });

    expect(result.status).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("drops incomplete cards and rejects when none are left", async () => {
    const fetchImpl = makeFetch();

    const result = await saveGeneratedFlashcards({
      title: "OS Concepts",
      cards: [{ front: "Only a front", back: "" }, { front: "", back: "x" }],
      fetchImpl,
    });

    expect(result.status).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});