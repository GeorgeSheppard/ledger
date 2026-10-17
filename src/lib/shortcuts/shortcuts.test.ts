import { describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutBinding } from './bindings';
import { chordFromEvent, formatKeys, normalizeChord, parseSequence } from './keys';
import { SEQUENCE_TIMEOUT_MS, SequenceMatcher } from './matcher';

const event = (
  key: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {}
) => ({
  key,
  metaKey: !!mods.meta,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
});

describe('keys', () => {
  it('normalises modifier order', () => {
    expect(normalizeChord('Shift+Mod+N')).toBe('mod+shift+n');
    expect(parseSequence('g  d')).toEqual(['g', 'd']);
  });

  it('reads chords from events per platform', () => {
    expect(chordFromEvent(event('Enter', { meta: true }), true)).toBe('mod+enter');
    expect(chordFromEvent(event('Enter', { ctrl: true }), false)).toBe('mod+enter');
    expect(chordFromEvent(event('N', { shift: true }), false)).toBe('shift+n');
    expect(chordFromEvent(event('?', { shift: true }), false)).toBe('?');
    expect(chordFromEvent(event('Shift', { shift: true }), false)).toBeNull();
  });

  it('formats labels', () => {
    expect(formatKeys('mod+enter', true)).toEqual([['⌘', '↵']]);
    expect(formatKeys('g d', false)).toEqual([['G'], ['D']]);
  });
});

describe('SequenceMatcher', () => {
  const candidates = [
    { id: 'dash', keys: 'g d' },
    { id: 'new', keys: 'n' },
  ];

  it('matches single chords and sequences', () => {
    const m = new SequenceMatcher<string>();
    expect(m.feed('n', 0, candidates)).toBe('new');
    expect(m.feed('g', 10, candidates)).toBe('pending');
    expect(m.feed('d', 20, candidates)).toBe('dash');
  });

  it('drops a stale sequence prefix', () => {
    const m = new SequenceMatcher<string>();
    m.feed('g', 0, candidates);
    expect(m.feed('d', SEQUENCE_TIMEOUT_MS + 1, candidates)).toBeNull();
  });

  it('restarts from the current chord when a sequence breaks', () => {
    const m = new SequenceMatcher<string>();
    m.feed('g', 0, candidates);
    expect(m.feed('n', 10, candidates)).toBe('new');
  });
});

describe('SHORTCUTS', () => {
  it('has no clashing keys', () => {
    const entries = Object.entries(SHORTCUTS) as [string, ShortcutBinding][];
    for (const [idA, a] of entries) {
      for (const [idB, b] of entries) {
        if (idA >= idB) continue;
        const shareScope = a.scope === b.scope || a.scope === 'global' || b.scope === 'global';
        const [sa, sb] = [parseSequence(a.keys), parseSequence(b.keys)];
        const shorter = sa.length <= sb.length ? sa : sb;
        const longer = shorter === sa ? sb : sa;
        const clash = shorter.every((c, i) => longer[i] === c);
        expect(shareScope && clash, `${idA} clashes with ${idB}`).toBe(false);
      }
    }
  });
});
