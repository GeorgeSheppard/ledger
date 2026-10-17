/**
 * Key notation used across the app:
 * - A chord is `+`-joined modifiers then a key: `mod+enter`, `shift+n`, `?`.
 *   `mod` is Cmd on macOS and Ctrl elsewhere.
 * - A sequence is space-separated chords pressed one after another: `g d`.
 * Keys are lower-case `KeyboardEvent.key` values (`enter`, `escape`, `arrowdown`, `/`).
 */

export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ORDER = ['mod', 'alt', 'shift'] as const;

/** Keys whose `key` value already reflects Shift, so Shift is not part of the chord. */
function shiftIsImplicit(key: string): boolean {
  return key.length === 1 && !/[a-z]/.test(key);
}

export function normalizeChord(chord: string): string {
  const parts = chord.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  const modifiers = MODIFIER_ORDER.filter((m) => parts.includes(m));
  return [...modifiers, key].join('+');
}

export function parseSequence(keys: string): string[] {
  return keys.trim().split(/\s+/).map(normalizeChord);
}

/** The chord a keyboard event represents, or null for a bare modifier press. */
export function chordFromEvent(event: KeyEventLike, isMac: boolean): string | null {
  const key = event.key.toLowerCase();
  if (['meta', 'control', 'alt', 'shift'].includes(key)) return null;
  const modifiers: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) modifiers.push('mod');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey && !shiftIsImplicit(key)) modifiers.push('shift');
  return [...modifiers, key].join('+');
}

const KEY_LABELS: Record<string, string> = {
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
};

/** Human-readable labels for each key in a binding, e.g. `mod+enter` → `['⌘', '↵']` on macOS. */
export function formatKeys(keys: string, isMac: boolean): string[][] {
  return parseSequence(keys).map((chord) =>
    chord.split('+').map((part) => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (part === 'alt') return isMac ? '⌥' : 'Alt';
      if (part === 'shift') return isMac ? '⇧' : 'Shift';
      return KEY_LABELS[part] ?? part.toUpperCase();
    })
  );
}

export function detectMac(): boolean {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}
