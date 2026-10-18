import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { formatKeys } from '../lib/shortcuts/keys';
import { useHeldModifiers, useIsMac } from '../state/shortcuts';
import { cn } from './cn';

/**
 * Renders a shortcut's keys side by side, e.g. `Ctrl D` or `⌘ ↵`. A modifier lights up while it
 * is held, so you can see the app is listening for the next key.
 */
export function Kbd({ shortcut, className }: { shortcut: ShortcutId; className?: string }) {
  const isMac = useIsMac();
  const held = useHeldModifiers();
  const keys = formatKeys(getBinding(shortcut).keys, isMac);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 no-keys:hidden', className)}
      aria-hidden="true"
    >
      {keys.map(({ label, modifier }) => (
        <kbd
          key={label}
          className={cn(
            'min-w-[1.4em] rounded border border-b-2 border-current/25 px-1.5 text-center font-sans text-[0.75em] leading-snug opacity-80 transition-colors',
            modifier && held.includes(modifier) && 'border-current bg-current/30 opacity-100'
          )}
        >
          {label}
        </kbd>
      ))}
    </span>
  );
}
