// Sample AI generation responses for mocked tests (SCRUM-216).
//
// These follow the PROPOSED response contract (POST /api/ai/flashcards ->
// { flashcards: [{ front, back }] }), which is not yet confirmed with Zack.
// Note the cards carry no `id`: flashcardContract.js requires one, so whoever
// owns ID assignment (frontend vs backend) must be settled before SCRUM-123.
// Update these fixtures to match whatever is agreed.

export const validGenerationResponse = {
  flashcards: [
    {
      front: "What is encapsulation?",
      back: "Restricting direct access to an object's internal state.",
    },
    {
      front: "Why is encapsulation useful?",
      back: "It protects data and controls how objects interact.",
    },
  ],
};

export const emptyGenerationResponse = { flashcards: [] };

export const malformedGenerationResponse = {
  flashcards: [
    { front: "Missing a back" },
    { front: "", back: "Empty front" },
    "not an object",
    null,
  ],
};

export const failedGenerationResponse = {
  error: "Flashcard generation failed.",
};