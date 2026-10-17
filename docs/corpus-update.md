# Updating corpus data (Tatoeba → deck)

Read this before regenerating or reviewing sentences from Tatoeba.

Tatoeba sentences reach a deck in four steps. Agents doing this again follow
them exactly; never hand-edit `tatoeba.json`.

1. `pnpm run data` downloads the exports into `.cache/` and regenerates every
   deck's `tatoeba.json` (`scripts/build-<deck>.ts`, shared reading in
   `scripts/tatoeba.ts`). Ids are `t<tatoeba id>`, so a sentence keeps its id
   across runs; new sentences simply have no review yet.
2. `pnpm run review:export <deck>` writes every item without an entry in the
   deck's `overrides.json` into `.cache/review/<deck>/batch-<n>.jsonl`, plus a
   ready prompt `prompt-<n>.md` per batch (templates in
   `scripts/review/prompts/`).
3. Start one reviewer agent per `prompt-<n>.md`, all in parallel. Each writes
   `out-<n>.jsonl`: exclusions, extra correct answers, missing German/English
   translations and, per deck, category and explanation.
4. `pnpm run review:merge <deck>` validates the output (unknown ids,
   duplicates, invalid categories abort the merge) and writes one entry per
   reviewed item into `overrides.json`, an empty `{}` when nothing changed.
   Then `pnpm run verify`: the deck tests fail while any sentence is
   unreviewed, uncredited or untranslated.

A new corpus deck needs a generator script, an entry in
`scripts/review/decks.ts` and a prompt template.
