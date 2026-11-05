# Frontend tests

All frontend unit and component tests live in this directory, grouped by feature.

- `auth/` - protected routes and logout interactions
- `dashboard/` - dashboard rendering and links
- `flashcards/` - flashcard data contracts, sources, and page behavior
- `textbooks/` - textbook page behavior
- `setup.js` - shared Vitest and Testing Library setup

From `frontend/`:

```bash
npm ci
npm test
npm run lint
npm run build
```

Vitest discovers `*.test.js` and `*.test.jsx` recursively, including files under `src/test/`.
Existing production source files are unchanged.
