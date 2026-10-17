# Scheduling, sessions, garden and XP

Read this before changing scheduling (FSRS), daily limits, sessions, ratings, the garden, XP or the shop.


- Scheduling is FSRS as the library intends it (`ts-fsrs` 5.x, wrapped in
  `src/core/srs.ts`): 90 % retention, default learning steps (1 m, 10 m),
  relearning 10 m, no fuzz so it stays deterministic; `now` is always passed in.
  A card holds `stability` (days until the chance of remembering drops to
  90 %, i.e. the interval), `difficulty` and the learning step; a new card
  graduates after two right answers (or one `easy`). Do not bend FSRS to fit
  the app: change the app instead.
- The garden (`src/core/garden.ts`) is how progress shows: every item is a
  plant whose stage is read from the card's **stability** (seed, sprout,
  plant, bush from 7 days, tree from 21, blossom from 60). Only a wrong answer
  (`lastGrade` `again`) wilts it; after a right one it grows back to the stage
  its remaining stability supports, which is lower than before. Nothing about
  plants is stored; they follow the cards.
- The pace is limited per day as in Anki (`src/core/daily.ts`): `newPerDay` new
  items and `reviewsPerDay` reviews of graduated cards, counted in
  `Progress` (`newToday`, `reviewsToday`, reset on a new local day). Cards
  still being learned are never counted or held back. The settings warn when
  the review limit is below ten times the new limit. A session
  (`sessionSize`) is a chunk of what is left of today's room.
- A right answer is rated automatically from the response time
  (`gradeFromAnswer`, thresholds per task type in `TASK_TYPES[kind].timing`).
  With the setting `manualRating` the learner rates it instead (hard, good,
  easy, each with its next delay): `answer()` then only stores the pending
  rating in the feedback (`ratingOptions`, saved with the session), and the
  card is reviewed and the answer paid in `rate()`. Wrong answers are always
  `again`; practice mode never asks. A wrong answer is re-asked once later in
  the same session (`requeue`), which fits the one-minute first step.
- `buildSession` splits the slots between reviews and new items in proportion
  to what is available today (a backlog never keeps new items out, new items
  never crowd out reviews), then deals each kind round-robin across decks.
  One deck's backlog never crowds out the others.
- There is always something to practise. When `buildSession` finds nothing
  (nothing due, no room for new items today), the store starts a session in mode
  `practice` (`buildPracticeSession`): random known items, no card is
  reviewed, no seed sown, nothing counted against the limits, so plants neither grow nor wilt. A correct answer
  pays only `PRACTICE_XP_CORRECT` (no combo bonus), but counts towards the
  daily goal and its bonus; a completed practice session keeps the streak.
- XP is pure gamification and only grows. The UI calls it money («kr», `formatMoney`);
  code and stored data keep the name `xp`. There are no levels; the badges
  `level-5`/`level-10` keep their ids and now mean 6 400 / 32 400 XP.
- Plant species (`src/core/species.ts`) are bought with XP in the seed shop
  (`#hage/butikk`). The shop tracks `spentXp` in the stored `garden`, so total
  XP never drops. An item gets a random owned species when it is first
  answered; that mapping is stored too and never changes. Drawings per
  species live in `src/ui/modules/garden/species-art.ts`.
- Garden routes: `#hage` (one screen, the bed pages sideways), `#plante/<id>`,
  `#hage/info`, `#hage/butikk`. Modules link with `modules/shared/links.ts`.
