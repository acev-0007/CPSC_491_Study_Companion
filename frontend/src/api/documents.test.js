import { afterEach, describe, expect, it, vi } from "vitest";

import { getDocumentAiContent } from "./documents";

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDocumentAiContent", () => {
  it("requests the encoded ai-content route with cookies and no user-id header", async () => {
    const fetchMock = mockFetch(200, { documentId: "a/b c", status: "ready", text: "hi" });

    const body = await getDocumentAiContent("a/b c");

    expect(body.text).toBe("hi");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/documents/a%2Fb%20c/ai-content");
    expect(options.credentials).toBe("same-origin");
    expect(options.headers).toBeUndefined();
  });

  it("passes an abort signal through to fetch", async () => {
    const fetchMock = mockFetch(200, { text: "x" });
    const controller = new AbortController();

    await getDocumentAiContent("1", { signal: controller.signal });

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it.each([401, 403, 404, 409, 422])("rejects with status %i attached", async (status) => {
    mockFetch(status, { error: "nope" });

    await expect(getDocumentAiContent("1")).rejects.toMatchObject({
      message: "nope",
      status,
    });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    mockFetch(500, undefined);

    await expect(getDocumentAiContent("1")).rejects.toMatchObject({
      message: "Request failed.",
      status: 500,
    });
  });

  it("propagates network failures without a status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getDocumentAiContent("1")).rejects.toMatchObject({ name: "TypeError" });
  });
});