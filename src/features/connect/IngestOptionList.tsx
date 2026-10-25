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
      {INGEST_OPTIONS.map((option, index) => {
        const last = option.id === lastUsed;
        // The option to push people towards: the one used last time, else the first.
        const primary = lastUsed ? last : index === 0;
        return (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(option)}
              className={cn(
                'flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                primary
                  ? 'border-accent bg-accent text-accent-fg shadow-md hover:bg-accent-hover'
                  : 'border-line bg-surface hover:bg-surface-hover'
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                {option.title}
                {last && (
                  <span className="rounded-full bg-accent-fg px-2 py-0.5 text-xs font-medium text-accent">
                    Last used
                  </span>
                )}
              </span>
              <span className={cn('text-sm', primary ? 'text-accent-fg/85' : 'text-muted')}>
                {option.description}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
