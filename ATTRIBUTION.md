# Attribution

## Project license

The source code of this project is licensed under the
[GNU Affero General Public License v3.0 or later](./LICENSE) (`AGPL-3.0-or-later`).
The AGPL does **not** cover the third-party material below; each part
keeps its own license:

| Part | License | Where |
| --- | --- | --- |
| Tatoeba sentences and generated exercises | CC BY 2.0 FR | `src/decks/prepositions/exercises.json` |
| Fonts (Literata, Atkinson Hyperlegible) | SIL OFL 1.1 | bundled via Fontsource |
| Lit | BSD-3-Clause | bundled into the app's JavaScript |

All of these are compatible with distributing the app under the AGPL: Lit is
GPL-compatible, the fonts ship as separate files (an aggregate under the OFL),
and the sentence data stays a separately licensed work. The notices on this
page must be kept.

## Sentences — Tatoeba

The generated exercises use Norwegian (bokmål) sentences and their German and
English translations from [Tatoeba](https://tatoeba.org), a collaborative
collection of sentences and translations. They are licensed under
[Creative Commons Attribution 2.0 France (CC BY 2.0 FR)](https://creativecommons.org/licenses/by/2.0/fr/).

Sentences are used as published, apart from blanking out the word an exercise
asks for. Every generated exercise keeps the Tatoeba id of its Norwegian
source sentence, and the app links each one back to
`https://tatoeba.org/sentences/show/<id>`. That page lists the sentence's
contributor and its linked translations.

Hand-written exercises (the curated set in `src/decks/`) are original to this
project.

## Fonts

All fonts are bundled through [Fontsource](https://fontsource.org) and are
licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).

- **Literata** — Copyright 2017 The Literata Project Authors
  (<https://github.com/googlefonts/literata>).
- **Atkinson Hyperlegible Next** — Copyright 2020–2024 The Atkinson
  Hyperlegible Next Project Authors
  (<https://github.com/googlefonts/atkinson-hyperlegible-next>).
- **Atkinson Hyperlegible Mono** — Copyright 2020–2024 The Atkinson
  Hyperlegible Mono Project Authors
  (<https://github.com/googlefonts/atkinson-hyperlegible-next-mono>).

Atkinson Hyperlegible was designed for the Braille Institute of America.

## Libraries

- **Lit** (`lit`, `lit-html`, `lit-element`, `@lit/reactive-element`) —
  Copyright (c) 2017 Google LLC. Licensed under the
  [BSD 3-Clause License](https://github.com/lit/lit/blob/main/LICENSE).
  Its license comments are preserved in the built JavaScript.

Build tools (Vite, TypeScript, Vitest, …) are development dependencies only and
are not shipped with the app.
