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

- `src/core/` — domain types, SRS, gamification, session building, storage,
  store, stats. Pure and unit-tested.
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

### Adding a topic

1. Create `src/decks/<topic>/index.ts` exporting a `Deck`.
2. Add it to `DECKS` in `src/decks/registry.ts`.

Nothing else changes: scheduler, stats and UI are deck-agnostic.

### Adding a question format

1. Extend `ExerciseKind` in `src/core/types.ts`.
2. Handle the new case in `src/core/checker.ts`.
3. Render it in `src/ui/modules/practice/exercise-card.ts`.

TypeScript's exhaustiveness checks point at every spot that needs work.

## Updates and stored data

The app is a PWA (`registerType: 'prompt'`). A new image is downloaded in the
background; `src/ui/modules/update/` shows "Oppdater" outside practice and
checks for updates hourly. Users' progress lives only in their browser's
localStorage, so every deploy must keep it readable:

- **Exercise ids are permanent.** SRS history is keyed by them
  (`p-curated-<id>`, `p-tpl-<template>-<filler>`, `p-t<tatoeba id>`). Never
  reuse or renumber an id; removed exercises are simply ignored.
- **Additive changes** (new optional field): give it a default in the
  `parse*` function in `src/core/storage.ts`. No version bump.
- **Breaking changes** (rename, restructure, changed meaning): bump
  `STATE_VERSION` and add a step to `MIGRATIONS` that upgrades raw data from
  the previous version. Add a test with old data.
- A build that finds data from a *newer* version stops saving
  (`newerVersionStored`) and asks for a reload, so an old tab never overwrites
  newer data.
- localStorage keys (`norskinator.state`, `.session`, `.seenBadges`,
  `.tourDone`) are permanent once released: renaming one wipes every
  learner's progress unless a migration copies the old key first.
- The running session is stored separately (`norskinator.session`) and resumed
  after a reload.

## Data

Sentences come from [Tatoeba](https://tatoeba.org), licensed **CC BY 2.0 FR**.
Attribution is required and lives in `ATTRIBUTION.md` and in the app's about
section. The generated bundle is committed, so builds never need network.
