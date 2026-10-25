import { describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutBinding } from './bindings';
import { chordFromEvent, formatKeys, heldModifiers, normalizeChord } from './keys';

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
  });

  it('reads chords from events per platform', () => {
    expect(chordFromEvent(event('Enter', { meta: true }), true)).toBe('mod+enter');
    expect(chordFromEvent(event('Enter', { ctrl: true }), false)).toBe('mod+enter');
    expect(chordFromEvent(event('N', { shift: true }), false)).toBe('shift+n');
    expect(chordFromEvent(event('?', { shift: true }), false)).toBe('?');
    expect(chordFromEvent(event('Shift', { shift: true }), false)).toBeNull();
    expect(chordFromEvent(event('Control', { ctrl: true }), false)).toBeNull();
  });

  it('reports held modifiers per platform', () => {
    expect(heldModifiers(event('Control', { ctrl: true }), false)).toEqual(['mod']);
    expect(heldModifiers(event('Control', { ctrl: true }), true)).toEqual([]);
    expect(heldModifiers(event('Meta', { meta: true, shift: true }), true)).toEqual([
      'mod',
      'shift',
    ]);
  });

  it('formats labels', () => {
    expect(formatKeys('mod+enter', true)).toEqual([
      { label: '⌘', modifier: 'mod' },
      { label: '↵' },
    ]);
    expect(formatKeys('mod+d', false)).toEqual([
      { label: 'Ctrl', modifier: 'mod' },
      { label: 'D' },
    ]);
  });
});

describe('SHORTCUTS', () => {
  const entries = Object.entries(SHORTCUTS) as [string, ShortcutBinding][];

  it('has no clashing keys', () => {
    for (const [idA, a] of entries) {
      for (const [idB, b] of entries) {
        if (idA >= idB) continue;
        const shareScope = a.scope === b.scope || a.scope === 'global' || b.scope === 'global';
        const clash = normalizeChord(a.keys) === normalizeChord(b.keys);
        expect(shareScope && clash, `${idA} clashes with ${idB}`).toBe(false);
      }
    }
  });

  it('uses single chords only', () => {
    for (const [id, { keys }] of entries) expect(keys, id).not.toMatch(/\s/);
  });

  it('avoids chords the browser keeps or that break copy, find and reload', () => {
    const reserved = ['n', 't', 'w', 'c', 'v', 'x', 'f', 'r', 'l', 'p', 'q', 'tab'];
    for (const [id, { keys }] of entries) {
      const chord = normalizeChord(keys);
      if (!chord.startsWith('mod+')) continue;
      expect(reserved, `${id} uses ${keys}`).not.toContain(chord.split('+').at(-1));
    }
  });
});
