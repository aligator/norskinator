/**
 * Step 1 of the corpus review: writes every generated Tatoeba item that has
 * no entry in the deck's `overrides.json` yet into batches, plus one ready
 * prompt per batch for a reviewer agent.
 *
 *   pnpm run review:export <deck> [batch size, default 150]
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { deckFromArgs, promptTemplate, readBundle, readOverrideEntries, reviewDir } from './decks.ts';

const DEFAULT_BATCH_SIZE = 150;

async function main(): Promise<void> {
  const deck = deckFromArgs();
  const batchSize = Number(process.argv[3] ?? DEFAULT_BATCH_SIZE);
  const bundle = await readBundle(deck);
  const reviewed = await readOverrideEntries(deck);
  const template = await readFile(promptTemplate(deck), 'utf8');

  const pending = bundle.items.filter((item) => !(`${deck.idPrefix}${item.id}` in reviewed));
  const dir = reviewDir(deck);

  // Old batches and outputs would be merged again by mistake.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const batchCount = Math.ceil(pending.length / batchSize);

  for (let batch = 0; batch < batchCount; batch += 1) {
    const items = pending.slice(batch * batchSize, (batch + 1) * batchSize);
    const lines = items.map((item) =>
      JSON.stringify({
        id: `${deck.idPrefix}${item.id}`,
        prompt: item.prompt,
        solution: item.solution,
        ...(item.hint === undefined ? {} : { hint: item.hint }),
        answer: item.answer,
        ...(item.options === undefined ? {} : { options: item.options }),
        ...(item.tiles === undefined ? {} : { tiles: item.tiles }),
        alternatives: item.alternatives ?? [],
        tags: item.tags,
        translations: item.translations ?? {},
      }),
    );
    const input = join(dir, `batch-${batch}.jsonl`);
    const output = join(dir, `out-${batch}.jsonl`);

    await writeFile(input, `${lines.join('\n')}\n`, 'utf8');
    await writeFile(
      join(dir, `prompt-${batch}.md`),
      template.replaceAll('{{input}}', input).replaceAll('{{output}}', output),
      'utf8',
    );
  }

  console.log(`${pending.length} unreviewed items of ${bundle.items.length} -> ${batchCount} batches in ${dir}`);
  console.log('Next: one reviewer agent per prompt-<n>.md (in parallel), then pnpm run review:merge ' + deck.id);
}

await main();
