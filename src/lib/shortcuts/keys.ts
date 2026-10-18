/**
 * Key notation used across the app: a shortcut is one chord, `+`-joined modifiers then a key:
 * `mod+d`, `shift+n`, `?`. `mod` is Cmd on macOS and Ctrl elsewhere.
 * Keys are lower-case `KeyboardEvent.key` values (`enter`, `escape`, `arrowdown`, `/`).
 */

export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export type Modifier = 'mod' | 'alt' | 'shift';

const MODIFIER_ORDER: readonly Modifier[] = ['mod', 'alt', 'shift'];

/** Keys whose `key` value already reflects Shift, so Shift is not part of the chord. */
function shiftIsImplicit(key: string): boolean {
  return key.length === 1 && !/[a-z]/.test(key);
}

export function normalizeChord(chord: string): string {
  const parts = chord.trim().toLowerCase().split('+');
  const key = parts.pop() ?? '';
  const modifiers = MODIFIER_ORDER.filter((m) => parts.includes(m));
  return [...modifiers, key].join('+');
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

/** The modifiers held down during a keyboard event, so the UI can light them up. */
export function heldModifiers(event: KeyEventLike, isMac: boolean): Modifier[] {
  const held: Modifier[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) held.push('mod');
  if (event.altKey) held.push('alt');
  if (event.shiftKey) held.push('shift');
  return held;
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

const MODIFIER_LABELS: Record<Modifier, { mac: string; other: string }> = {
  mod: { mac: '⌘', other: 'Ctrl' },
  alt: { mac: '⌥', other: 'Alt' },
  shift: { mac: '⇧', other: 'Shift' },
};

export interface KeyLabel {
  label: string;
  /** Set when this key is a modifier, so it can be highlighted while held. */
  modifier?: Modifier;
}

/** Human-readable labels for each key in a binding, e.g. `mod+d` → `Ctrl`, `D`. */
export function formatKeys(keys: string, isMac: boolean): KeyLabel[] {
  return normalizeChord(keys)
    .split('+')
    .map((part) => {
      if (part in MODIFIER_LABELS) {
        const modifier = part as Modifier;
        return { label: MODIFIER_LABELS[modifier][isMac ? 'mac' : 'other'], modifier };
      }
      return { label: KEY_LABELS[part] ?? part.toUpperCase() };
    });
}

export function detectMac(): boolean {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}
