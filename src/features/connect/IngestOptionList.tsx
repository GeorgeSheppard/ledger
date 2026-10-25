import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { INGEST_OPTIONS, type IngestOption } from '../../modules/ingest';
import { useSession } from '../../state/session';
import { cn } from '../../ui/cn';

/**
 * Every way of bringing a ledger in, as cards, with the one used last time highlighted. The
 * choices come from the ingest registry, so a new ingest module appears here automatically.
 */
export function IngestOptionList({
  lastUsed,
  onChoose,
  onOpened,
}: {
  lastUsed: string | null;
  /** An option with steps of its own was picked. */
  onChoose(option: IngestOption): void;
  /** An option with no steps (the example) opened its ledger straight away. */
  onOpened?(): void;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const choose = (option: IngestOption) => {
    if (!('openDirectly' in option)) return onChoose(option);
    option.openDirectly(session);
    onOpened?.();
    navigate(paths.home);
  };
  return (
    <ul className="flex flex-col gap-3">
      {INGEST_OPTIONS.map((option) => {
        const last = option.id === lastUsed;
        return (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => choose(option)}
              disabled={!!option.unavailable}
              className={cn(
                'flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'bg-surface shadow-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface',
                last ? 'border-accent ring-1 ring-accent' : 'border-line'
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                {option.title}
                {last && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    Used last time
                  </span>
                )}
              </span>
              <span className="text-sm text-muted">{option.unavailable ?? option.description}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
