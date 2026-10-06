/**
 * Downloads the raw Tatoeba exports used to generate exercises.
 *
 * Output lands in .cache/ (git-ignored). The generated exercise bundle is
 * committed, so neither CI nor the published site ever needs network access.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bz2 from 'unbzip2-stream';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CACHE_DIR = join(ROOT, '.cache');

const BASE = 'https://downloads.tatoeba.org/exports/per_language';

const DOWNLOADS = [
  { name: 'nob_sentences.tsv', url: `${BASE}/nob/nob_sentences.tsv.bz2` },
  { name: 'deu_sentences.tsv', url: `${BASE}/deu/deu_sentences.tsv.bz2` },
  { name: 'eng_sentences.tsv', url: `${BASE}/eng/eng_sentences.tsv.bz2` },
  { name: 'nob-deu_links.tsv', url: `${BASE}/nob/nob-deu_links.tsv.bz2` },
  { name: 'nob-eng_links.tsv', url: `${BASE}/nob/nob-eng_links.tsv.bz2` },
] as const;

async function hasContent(path: string): Promise<boolean> {
  try {
    const info = await stat(path);

    return info.size > 0;
  } catch {
    return false;
  }
}

async function download(name: string, url: string): Promise<void> {
  const target = join(CACHE_DIR, name);

  if (await hasContent(target)) {
    console.log(`cached  ${name}`);

    return;
  }

  console.log(`fetch   ${name}`);
  const response = await fetch(url);

  if (!response.ok || response.body === null) {
    throw new Error(`${url} -> HTTP ${response.status}`);
  }

  // Writing to a side file keeps an interrupted download from looking cached.
  const partial = `${target}.part`;
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);

  try {
    await pipeline(source, bz2(), createWriteStream(partial));
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });

    throw error;
  }

  console.log(`done    ${name}`);
}

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });

  for (const { name, url } of DOWNLOADS) {
    await download(name, url);
  }
}

await main();
