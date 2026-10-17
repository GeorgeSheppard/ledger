import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { getBinding, SHORTCUTS, type ShortcutId } from '../lib/shortcuts/bindings';
import { chordFromEvent, detectMac } from '../lib/shortcuts/keys';
import { SequenceMatcher } from '../lib/shortcuts/matcher';

/**
 * One global keydown listener dispatching to whichever components currently registered a handler
 * for a shortcut id. A shortcut only fires while something is mounted that handles it, so scopes
 * follow the page naturally. When several handlers share an id, the most recently mounted wins.
 */

type Handler = (event: KeyboardEvent) => void;

interface ShortcutRegistry {
  register(id: ShortcutId, handler: { current: Handler }): () => void;
  isMac: boolean;
}

const ShortcutContext = createContext<ShortcutRegistry | null>(null);

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Map<ShortcutId, { current: Handler }[]>());
  const isMac = useMemo(() => detectMac(), []);

  useEffect(() => {
    const matcher = new SequenceMatcher<ShortcutId>();
    const onKeyDown = (event: KeyboardEvent) => {
      const chord = chordFromEvent(event, isMac);
      if (!chord) return;
      const inInput = isTextInput(event.target);
      const candidates = [...handlers.current.keys()]
        .filter((id) => !inInput || getBinding(id).allowInInputs)
        .map((id) => ({ id, keys: SHORTCUTS[id].keys }));
      const match = matcher.feed(chord, event.timeStamp, candidates);
      if (match === null) return;
      event.preventDefault();
      if (match === 'pending') return;
      handlers.current.get(match)?.at(-1)?.current(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMac]);

  const registry = useMemo<ShortcutRegistry>(
    () => ({
      isMac,
      register(id, handler) {
        const list = handlers.current.get(id) ?? [];
        handlers.current.set(id, [...list, handler]);
        return () => {
          const remaining = (handlers.current.get(id) ?? []).filter((h) => h !== handler);
          if (remaining.length) handlers.current.set(id, remaining);
          else handlers.current.delete(id);
        };
      },
    }),
    [isMac]
  );

  return <ShortcutContext.Provider value={registry}>{children}</ShortcutContext.Provider>;
}

function useRegistry(): ShortcutRegistry {
  const registry = useContext(ShortcutContext);
  if (!registry) throw new Error('Shortcut hooks must be used inside <ShortcutProvider>');
  return registry;
}

/** Runs `handler` when the shortcut is pressed, while this component is mounted and `enabled`. */
export function useShortcut(id: ShortcutId, handler: Handler, enabled = true) {
  const { register } = useRegistry();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => (enabled ? register(id, ref) : undefined), [id, enabled, register]);
}

export function useIsMac(): boolean {
  return useRegistry().isMac;
}
