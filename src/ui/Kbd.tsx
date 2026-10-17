import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { formatKeys } from '../lib/shortcuts/keys';
import { useIsMac } from '../state/shortcuts';
import { cn } from './cn';

/** Renders a shortcut's keys, e.g. `⌘ ↵` or `G then D`. */
export function Kbd({ shortcut, className }: { shortcut: ShortcutId; className?: string }) {
  const isMac = useIsMac();
  const chords = formatKeys(getBinding(shortcut).keys, isMac);
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="mx-0.5 text-[0.75em] opacity-70">then</span>}
          {chord.map((key) => (
            <kbd
              key={key}
              className="min-w-[1.4em] rounded border border-b-2 border-current/25 px-1.5 text-center font-sans text-[0.75em] leading-snug opacity-80"
            >
              {key}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
