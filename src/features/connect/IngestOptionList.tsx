import { INGEST_OPTIONS, type IngestOption } from '../../modules/ingest';
import { cn } from '../../ui/cn';

/**
 * Every way of bringing a ledger in, as cards, with the one used last time highlighted. The
 * choices come from the ingest registry, so a new ingest module appears here automatically.
 */
export function IngestOptionList({
  lastUsed,
  onChoose,
}: {
  lastUsed: string | null;
  onChoose(option: IngestOption): void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {INGEST_OPTIONS.map((option) => {
        const last = option.id === lastUsed;
        return (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option)}
              className={cn(
                'flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border bg-surface p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                last ? 'border-accent ring-1 ring-accent' : 'border-line'
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                {option.title}
                {last && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
                    Last used
                  </span>
                )}
              </span>
              <span className="text-sm text-muted">{option.description}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
