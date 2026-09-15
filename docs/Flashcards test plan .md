# Flashcards Subsystem — Sprint 1 Test Plan

**Author:** Anthony Acevedo
**Role:** Flashcards & Quiz System Lead
**Course:** CPSC 491 — AI Study Companion
**Tickets covered:** FLASH-1, FLASH-2, FLASH-3

---

## 1. Purpose and scope

This document describes how the Sprint 1 Flashcards subsystem is verified, why
each testing technique was chosen, and what was deliberately left out of scope.

**In scope:** the flashcard data contract, the data-source interface, and the
Flashcards page interactions (flip, next/previous, edit, loading/empty/error
states).

**Out of scope for Sprint 1:** backend API tests, database integration tests,
AI-generation tests, quiz logic, and authentication. Those depend on components
that do not exist yet. Section 6 explains how this suite is designed to absorb
them without being rewritten.

---

## 2. Testing strategy — and the alternatives considered

Three approaches were considered before settling on the current strategy.

**Option A — Manual test cases only.** Cheapest to produce and the sprint plan
permitted it ("these can initially be documented manual tests"). Rejected as the
primary method because manual cases produce no regression protection. The
teammate PR that rewrote `index.css` and silently removed the shared design
tokens is a concrete example from this sprint: nothing failed loudly, and the
breakage was only caught by inspection. Manual testing does not scale across six
sprints.

**Option B — End-to-end tests (Cypress/Playwright) driving a real browser.**
Highest fidelity, but heavy to configure, slow to run, and dependent on a
backend that does not exist yet. Disproportionate for an eight-card mock
prototype.

**Option C (chosen) — Unit tests on the data layer plus black-box component
tests on the page, using Vitest and React Testing Library.** Vitest was selected
over Jest because the project already builds with Vite, so Vitest reuses the
existing `vite.config.js` and requires no separate Babel/transform setup.

Manual testing was retained as a *supplement*, not a replacement — see §5.

### Techniques applied

| Technique | Where applied | Why |
|---|---|---|
| Unit testing | `flashcardContract.test.js` | Pure validation functions, isolated from React |
| Equivalence partitioning | `isValidFlashcard` invalid cases | Groups inputs into valid/invalid classes so each failure *class* is covered once instead of testing arbitrary values |
| Boundary value analysis | Set size (4/5/10/11), first/last card | Off-by-one errors cluster at boundaries; these are exactly where navigation bugs live |
| Black-box testing | `Flashcards.test.jsx` | Tests query by visible label/role and never touch component state, so internals can be refactored freely |
| Negative / failure-path testing | Loading, empty, rejected promise | The failure paths matter more once a real API and AI service can fail |

---

## 3. Architecture supporting the tests

A deliberate design decision was made *for testability and migration*: the page
does not import the mock array directly.

```
Flashcards.jsx  →  flashcardSource.getFlashcards()  →  flashcardContract
   (page)              (swap point)                      (shape rules)
                             ↓
                     mockFlashcards.js  ← Sprint 1 only
```

- **`flashcardContract.js`** defines what a valid flashcard *is*, once.
- **`flashcardSource.js`** is the single place the data origin is decided.
- **`Flashcards.jsx`** consumes an async function and knows nothing about where
  cards come from.

**Justification:** the alternative was importing `mockFlashcards` straight into
the page, which is simpler for Sprint 1 but forces an edit to the page
component, the validation logic, *and* every test in Sprints 2 and 3. Splitting
the contract from the source costs roughly thirty extra lines now and confines
the future migration to one function body.

Because `getFlashcards()` is already `async`, the page already renders loading
and error states. A real `fetch()` introduces no new states.

---

## 4. Automated test coverage

**56 automated tests across 3 files. All passing.**

Run with:
```bash
cd frontend
npm install
npm test
```

### 4.1 `flashcardContract.test.js` — 27 tests

Validation rules independent of React and independent of the data source.

- Valid partition: numeric id, string id (a database will return one), extra
  keys tolerated (an API may add `topicId`/`createdAt` without breaking us)
- Invalid partition, 13 cases: `null`, `undefined`, array, bare string, missing
  id/front/back, empty string, whitespace-only, wrong type, `NaN` id
- Unique-id enforcement (duplicate ids break React keys)
- `normalizeFlashcards` drops bad entries instead of throwing
- Boundary analysis on set size: 4 rejected, 5 accepted, 10 accepted, 11 rejected

### 4.2 `flashcardSource.test.js` — 6 tests

Black-box tests against the data-source interface, plus the FLASH-1 acceptance
criteria applied to the real dataset.

- The mock dataset contains 5–10 cards (FLASH-1 acceptance criterion)
- Every card satisfies the contract
- `getFlashcards()` resolves to an array of contract-valid cards

These assert only on returned data, never on its origin — which is what makes
them reusable against a live API.

### 4.3 `Flashcards.test.jsx` — 23 tests

| Behavior | Tests |
|---|---|
| Initial render | First question shown; progress reads "Card 1 of N"; answer hidden until flipped |
| Flip (FLASH-2) | Front→back; back→front; Enter key; Space key |
| Navigation (FLASH-2) | Next advances; Previous returns; **Previous disabled on card 1**; **Next disabled on last card**; flip resets on card change; single-card set disables both |
| Edit (FLASH-2) | Form prefills current card; save updates display; cancel discards; edit affects only the current card; nav hidden during edit; saved card returns to front |
| States | Loading message; empty-set message; error on rejection; no controls when empty |

---

## 5. Manual test cases

Automated tests cannot verify visual rendering or the CSS variable dependency
described in §2. These were executed by hand against `npm run dev`:

| # | Steps | Expected | Result |
|---|---|---|---|
| M1 | Navigate to `/flashcards` | Page renders inside shared Layout | Pass |
| M2 | Inspect card | Border, background, and shadow visible (confirms `--border`, `--bg`, `--shadow` resolve) | Pass |
| M3 | Tab to card | Visible focus ring | Pass |
| M4 | Click card | Flips with readable answer text | Pass |
| M5 | Resize to mobile width | Card stays within viewport | Pass |
| M6 | Disabled Previous on card 1 | Renders visibly dimmed, not just non-functional | Pass |

**M2 is not cosmetic.** Flashcards.css consumes nine CSS custom properties from
the shared `:root` block. A change removing those variables produces no test
failure and no build error — only a silently unstyled page. M2 is the check that
catches it.

---

## 6. How this suite survives Sprints 2 and 3

The migration path was a design goal, not an afterthought.

**Sprint 2 (database/API).** Replace the body of `getFlashcards()` with a
`fetch("/api/flashcards")` call piped through `normalizeFlashcards()`. The
contract tests are unchanged — they never referenced the mock. The source tests
become live API contract tests. The component tests are unchanged because the
source is already mocked per-test.

**Sprint 3 (AI generation).** AI output is the least trustworthy data source in
the project: an LLM can return malformed JSON, drop a field, or emit an empty
answer. `normalizeFlashcards()` already filters those cases, and the 13 invalid
partition cases already encode them. A response of ten cards with two malformed
becomes eight usable cards instead of a crashed study session.

**Failure simulation** is already in place. `getFlashcards.mockRejectedValue()`
in the component tests is the same seam that will simulate an API outage or an
AI timeout — no new infrastructure required.

---

## 7. Known limitations

Stated openly rather than left for a reviewer to find:

1. **Edits are in-memory only.** Saving a card mutates React state and is lost on
   refresh. Persistence is Sprint 2 by design.
2. **No CSS regression testing.** M2 is manual. Visual regression tooling was
   judged disproportionate for this scope.
3. **No backend tests.** No backend exists yet.
4. **No accessibility audit.** Keyboard flip (Enter/Space) and focus are tested;
   a full screen-reader pass was not performed.
5. **Edit form accepts any non-empty text.** Only HTML `required` validation;
   contract-level validation on user edits would be the natural follow-up.

---

## 8. Results summary

| Check | Command | Result |
|---|---|---|
| Automated tests | `npm test` | 56/56 passing |
| Lint | `npm run lint` | Clean |
| Production build | `npm run build` | Succeeds |
| Manual cases | Browser | 6/6 passing |