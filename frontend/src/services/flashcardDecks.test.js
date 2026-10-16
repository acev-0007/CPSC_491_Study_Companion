import { describe, it, expect, vi } from "vitest";

import { listDecks, deleteDeck } from "./flashcardDecks";

const DECK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("listDecks (FLASH-DECK-1)", () => {
  it("requests GET /api/topics with credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ topics: [] }));

    await listDecks({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith("/api/topics", {
      credentials: "same-origin",
    });
  });

  it("maps topics to decks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        topics: [
          {
            id: DECK_ID,
            title: "Operating Systems",
            created_at: "2026-10-01T10:00:00Z",
            card_count: 5,
          },
        ],
      })
    );

    expect(await listDecks({ fetchImpl })).toEqual([
      {
        id: DECK_ID,
        title: "Operating Systems",
        createdAt: "2026-10-01T10:00:00Z",
        cardCount: 5,
      },
    ]);
  });

  it("defaults the card count to 0 when missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ topics: [{ id: DECK_ID, title: "Empty" }] })
      );

    const [deck] = await listDecks({ fetchImpl });

    expect(deck.cardCount).toBe(0);
  });

  it("drops malformed entries instead of failing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        topics: [
          null,
          { id: "not-a-uuid", title: "Bad id" },
          { id: DECK_ID, title: "   " },
          { id: DECK_ID, title: "Good" },
        ],
      })
    );

    const decks = await listDecks({ fetchImpl });

    expect(decks).toHaveLength(1);
    expect(decks[0].title).toBe("Good");
  });

  it("returns an empty list when the payload has no topics array", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));

    expect(await listDecks({ fetchImpl })).toEqual([]);
  });

  it("throws when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    await expect(listDecks({ fetchImpl })).rejects.toThrow(
      /failed to load saved decks/i
    );
  });
});

describe("deleteDeck (FLASH-DECK-1)", () => {
  it("sends DELETE /api/topics/:id with credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 204 });

    await deleteDeck(DECK_ID, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(`/api/topics/${DECK_ID}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
  });

  it("resolves on 204 No Content without reading a body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });

    await expect(deleteDeck(DECK_ID, { fetchImpl })).resolves.toBeUndefined();
  });

  it("rejects with the server message and status on failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "Topic not found." }, 404));

    await expect(deleteDeck(DECK_ID, { fetchImpl })).rejects.toMatchObject({
      message: "Topic not found.",
      status: 404,
    });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("bad json");
      },
    });

    await expect(deleteDeck(DECK_ID, { fetchImpl })).rejects.toThrow(/502/);
  });

  it("refuses an invalid id without making a request", async () => {
    const fetchImpl = vi.fn();

    await expect(deleteDeck("../etc", { fetchImpl })).rejects.toThrow(
      /invalid deck id/i
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});