/**
 * Guards the UI layering:
 *   components/ — generic, no domain imports
 *   modules/    — domain components; never reach up into pages/
 *   pages/      — composition and routing
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ui');
const SRC_ROOT = resolve(UI_ROOT, '..');

function sourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
      files.push(path);
    }
  }

  return files;
}

/** Every relative import of a file, resolved to a path below `src/`. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)].map((match) => match[1] ?? '');

  return specifiers.map((specifier) => relative(SRC_ROOT, resolve(dirname(file), specifier)));
}

function violations(layer: string, forbidden: readonly string[]): string[] {
  const found: string[] = [];

  for (const file of sourceFiles(join(UI_ROOT, layer))) {
    for (const target of importsOf(file)) {
      if (forbidden.some((prefix) => target.startsWith(prefix))) {
        found.push(`${relative(SRC_ROOT, file)} → ${target}`);
      }
    }
  }

  return found;
}

describe('UI layering', () => {
  it('keeps components free of domain code', () => {
    expect(violations('components', ['core/', 'decks/', 'ui/modules/', 'ui/pages/'])).toEqual([]);
  });

  it('never lets modules depend on pages', () => {
    expect(violations('modules', ['ui/pages/'])).toEqual([]);
  });
});
