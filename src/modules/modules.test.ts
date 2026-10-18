import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The module rules (docs/ARCHITECTURE.md, "Modules"): a module is a folder under `src/modules`
 * that can be added or removed without touching the others, so
 * - an implementation (`graphs/sankey`, `save/cloud`, …; `shared` and `ui` folders are common to their group) never imports a sibling implementation, and
 * - one module group only reaches into another through that group's `index.ts`.
 * Tests may reach in to build fixtures.
 */

const ROOT = join(__dirname);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/from\s+'(\.[^']*)'/g)].map((m) => resolve(dirname(file), m[1]!));
}

/** `ingest/google/x.ts` → group `ingest`, implementation `google`; files directly in a group have none. */
function place(path: string) {
  const [group, impl, rest] = relative(ROOT, path).split(sep);
  return { group, impl: rest === undefined ? undefined : impl };
}

describe('modules', () => {
  const all = files(ROOT);

  it('are not entangled with their siblings', () => {
    const offenders: string[] = [];
    for (const file of all) {
      const from = place(file);
      for (const target of importsOf(file)) {
        if (!target.startsWith(ROOT + sep)) continue;
        const to = place(target);
        const sibling = (impl?: string) => impl && impl !== 'shared' && impl !== 'ui';
        if (
          from.group === to.group &&
          sibling(from.impl) &&
          sibling(to.impl) &&
          from.impl !== to.impl
        )
          offenders.push(`${relative(ROOT, file)} → ${relative(ROOT, target)}`);
        if (from.group !== to.group && (to.impl || relative(ROOT, target).split(sep).length > 2)) {
          // Another group's internals; only its index is public.
          const rel = relative(ROOT, target);
          if (!/^[^/\\]+$/.test(rel)) offenders.push(`${relative(ROOT, file)} → ${rel}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
