# AGENTS.md

Norskinator — static Vite + Lit + TypeScript app for drilling Norwegian (bokmål)
grammar with spaced repetition. No backend logic, state lives in localStorage.
It ships as a Docker image: `dist/` served by nginx (`Dockerfile`,
`docker/nginx.conf`).

## Commands

```bash
pnpm install          # pnpm only, never npm/yarn
pnpm run dev          # vite dev server
pnpm run verify       # typecheck + tests + build
pnpm run data         # re-download Tatoeba and regenerate the exercise bundle
```

## Code style

Hard rules, enforced in review:

1. No one-line `if`. The body goes on its own line.
2. Never an `if`/`for`/`while` without braces.
3. Group statements with blank lines; a wall of code without breaks is a bug
   report waiting to happen.
4. Comment a group only when the comment adds information. A comment that
   restates the code must be deleted.
5. No single-letter identifiers.
6. TypeScript only, `strict` plus `noUncheckedIndexedAccess`. No `any`.
7. Core logic (`src/core/`) stays framework-free so it is testable without a
   DOM. Lit is only used in `src/ui/`.

## Architecture

- `src/core/` — domain types, task types, SRS, garden, gamification, session
  building, storage, store, stats. Pure and unit-tested.
- `src/decks/` — content. One folder per topic, registered in
  `src/decks/registry.ts`.

- `src/ui/` — Lit, in three layers:
  - `components/` — generic UI building blocks (progress ring/bar, segmented
    control, stepper, switch, icons, design tokens). **No imports from
    `core/`, `decks/`, `modules/` or `pages/`.**
  - `modules/<area>/` — domain components and UI logic per area
    (`practice`, `gamification`, `decks`, `stats`, `settings`, `shared`).
    May use `core/` and `components/`, never `pages/`. Navigation is
    requested through events (`exit`, `session-started`), not done directly.
  - `pages/` — `app-root` (shell, nav, routing, theme, live region) and one
    thin page per route that composes modules.
- `scripts/` — build-time data pipeline (`tsx`), never shipped to the browser.
- `tests/` — cross-cutting tests that need Node (`tests/ui-architecture.test.ts`
  enforces the UI layering above).

`tsconfig.json` covers `src/` without Node types; `tsconfig.node.json` covers
`scripts/`, `tests/` and `vite.config.ts`.

## Rules that always apply

- **Do not bend FSRS to fit the app.** Scheduling is `ts-fsrs` with its
  defaults (`src/core/srs.ts`); when a concept of the app does not fit, change
  the app.
- **Exercise ids are permanent** and saved progress must stay readable. Any
  change to what is stored needs a migration and a test with old data.
- Sentences come from [Tatoeba](https://tatoeba.org) (**CC BY 2.0 FR**);
  attribution lives in `ATTRIBUTION.md` and in the app's about section. The
  generated bundle is committed, so builds never need network.

## Docs

Read the one that matches your task before you start:

| Doc | When |
|---|---|
| [`docs/stored-data.md`](docs/stored-data.md) | Anything saved in localStorage (state, cards, settings, session), a new setting, an exercise id, a migration. |
| [`docs/srs-and-garden.md`](docs/srs-and-garden.md) | Scheduling (FSRS), daily limits, sessions, ratings, the garden, XP, the seed shop. |
| [`docs/decks-and-tasks.md`](docs/decks-and-tasks.md) | Decks and data items, task types, adding a topic or a question format. |
| [`docs/corpus-update.md`](docs/corpus-update.md) | Regenerating or reviewing Tatoeba sentences (`pnpm run data`). |

A change that makes a doc wrong updates that doc in the same PR.
