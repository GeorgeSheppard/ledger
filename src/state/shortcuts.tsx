import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getBinding, SHORTCUTS, type ShortcutId } from '../lib/shortcuts/bindings';
import {
  chordFromEvent,
  detectMac,
  heldModifiers,
  normalizeChord,
  type Modifier,
} from '../lib/shortcuts/keys';

/**
 * One global keydown listener dispatching to whichever components currently registered a handler
 * for a shortcut id. A shortcut only fires while something is mounted that handles it, so scopes
 * follow the page naturally. When several handlers share an id, the most recently mounted wins.
 * It also tracks which modifiers are held so `<Kbd>` can light up Ctrl while it is pressed.
 */

type Handler = (event: KeyboardEvent) => void;

interface ShortcutRegistry {
  register(id: ShortcutId, handler: { current: Handler }): () => void;
  isMac: boolean;
}

const ShortcutContext = createContext<ShortcutRegistry | null>(null);
// Separate from the registry so only key labels re-render when a modifier goes up or down.
const HeldModifiersContext = createContext<readonly Modifier[]>([]);

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Map<ShortcutId, { current: Handler }[]>());
  const isMac = useMemo(() => detectMac(), []);
  const [held, setHeld] = useState<readonly Modifier[]>([]);

  useEffect(() => {
    const updateHeld = (event: KeyboardEvent) => {
      const next = heldModifiers(event, isMac);
      setHeld((prev) => (prev.join() === next.join() ? prev : next));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      updateHeld(event);
      const chord = chordFromEvent(event, isMac);
      if (!chord) return;
      const inInput = isTextInput(event.target);
      const match = [...handlers.current.keys()].find(
        (id) =>
          (!inInput || getBinding(id).allowInInputs) && normalizeChord(SHORTCUTS[id].keys) === chord
      );
      if (!match) return;
      event.preventDefault();
      handlers.current.get(match)?.at(-1)?.current(event);
    };
    // Switching tab or window while holding Ctrl never delivers the keyup.
    const clearHeld = () => setHeld((prev) => (prev.length ? [] : prev));
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', updateHeld);
    window.addEventListener('blur', clearHeld);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', updateHeld);
      window.removeEventListener('blur', clearHeld);
    };
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

  return (
    <ShortcutContext.Provider value={registry}>
      <HeldModifiersContext.Provider value={held}>{children}</HeldModifiersContext.Provider>
    </ShortcutContext.Provider>
  );
}

function useRegistry(): ShortcutRegistry {
  const registry = useContext(ShortcutContext);
  if (!registry) throw new Error('Shortcut hooks must be used inside <ShortcutProvider>');
  return registry;
}

/** Runs `handler` when the shortcut is pressed, while this component is mounted and `enabled`. */
export function useShortcut(id: ShortcutId | undefined, handler: Handler, enabled = true) {
  const { register } = useRegistry();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => (enabled && id ? register(id, ref) : undefined), [id, enabled, register]);
}

export function useIsMac(): boolean {
  return useRegistry().isMac;
}

/** The modifiers currently held down (`mod` is Cmd on macOS, Ctrl elsewhere). */
export function useHeldModifiers(): readonly Modifier[] {
  return useContext(HeldModifiersContext);
}
