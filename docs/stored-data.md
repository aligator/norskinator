# Updates and stored data

Read this before changing anything that is saved in localStorage (state, cards, settings, session) or any exercise id.


The app is a PWA (`registerType: 'prompt'`). A new image is downloaded in the
background; `src/ui/modules/update/` shows "Oppdater" outside practice and
checks for updates hourly. Users' progress lives only in their browser's
localStorage, so every deploy must keep it readable:

- **Exercise ids are permanent.** SRS history is keyed by them
  (`p-curated-<id>`, `p-tpl-<template>-<filler>`, `p-t<tatoeba id>`,
  `a-t<tatoeba id>`, `w-t<tatoeba id>`). Never reuse or renumber an id; removed exercises are
  simply ignored.
- **Additive changes** (new optional field): give it a default in the
  `parse*` function in `src/core/storage.ts`. No version bump.
  Example: `speechRate` (read-aloud speed, a factor of the voice's normal pace,
  clamped to `SPEECH_RATE_BOUNDS`; default `0.95`) reads as the default from
  data saved before it existed. Every setting that is a number has its range
  enforced in `clampSettings`, on read and on every update.
- **Enum values are stored strings** (card phase, grade, plant stage, task
  type, session mode, species, theme, translation language). A member may be
  renamed freely; changing its value is a breaking change. Migrations work on
  raw data and keep the literal strings of their versions.
- **Breaking changes** (rename, restructure, changed meaning): bump
  `STATE_VERSION` and add a step to `MIGRATIONS` that upgrades raw data from
  the previous version. Add a test with old data. Version 2 replaced the SM-2
  card fields (`ease`, `intervalDays`) by FSRS ones (`stability`,
  `difficulty`, `learningStep`).
- A build that finds data from a *newer* version stops saving
  (`newerVersionStored`) and asks for a reload, so an old tab never overwrites
  newer data.
- localStorage keys (`norskinator.state`, `.session`, `.seenBadges`,
  `.tourDone`, `.shopTourDone`) are permanent once released: renaming one wipes every
  learner's progress unless a migration copies the old key first.
- The running session is stored separately (`norskinator.session`) and resumed
  after a reload.
