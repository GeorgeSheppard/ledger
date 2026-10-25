import type { SaveAction } from './useSaveAction';
import { cn } from '../../../ui/cn';

/**
 * A dot for whether edits are safe (green), waiting (accent), saving or failed (red). The words
 * appear next to it only when there is something to know; the rest of the time it is just a dot.
 */
export function SaveStatus({ action, className }: { action: SaveAction; className?: string }) {
  const dot = action.error
    ? 'bg-negative'
    : action.state === 'unsaved'
      ? 'bg-accent'
      : action.state === 'saving'
        ? 'animate-pulse bg-muted'
        : 'bg-positive';
  return (
    <div
      className={cn('flex items-center gap-2 text-sm', className)}
      aria-live="polite"
      title={action.error ?? action.text}
    >
      <span className={cn('size-2.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      <span className={cn(action.error && 'text-negative', !action.attention && 'sr-only')}>
        {action.text}
      </span>
    </div>
  );
}
