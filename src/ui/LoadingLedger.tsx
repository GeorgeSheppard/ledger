import type { LoadProgress } from '../lib/store/remote';

const MAX_CHIPS = 8;
const ROWS = 5;

/**
 * The loading screen's body: a ledger page whose rows write themselves in, then the name of what is
 * being read. Once the sheet's tabs are known they are listed, so a big spreadsheet shows what the
 * wait is for. Plain SVG and CSS (global.css); with reduced motion it holds still.
 */
export function LoadingLedger({ title, progress }: { title: string; progress?: LoadProgress }) {
  const tabs = progress?.step === 'values' ? progress.tabs : [];
  const shown = tabs.slice(0, MAX_CHIPS);
  const label =
    progress?.step === 'values'
      ? `Reading ${tabs.length} ${tabs.length === 1 ? 'sheet' : 'sheets'} from ${title}`
      : `Opening ${title}`;
  return (
    <div role="status" className="flex max-w-md flex-col items-center gap-4">
      <svg viewBox="0 0 120 96" className="h-24 w-32" aria-hidden="true">
        <rect
          x="4"
          y="4"
          width="112"
          height="88"
          rx="10"
          className="fill-surface stroke-line"
          strokeWidth="2"
        />
        {Array.from({ length: ROWS }, (_, row) => {
          const y = 18 + row * 15;
          return (
            <g key={row} className="ledger-write" style={{ '--row': row } as React.CSSProperties}>
              <circle cx="18" cy={y} r="3" className="fill-accent" />
              <rect
                x="28"
                y={y - 2.5}
                width={40 + ((row * 17) % 26)}
                height="5"
                rx="2.5"
                className="fill-line"
              />
              <rect
                x="92"
                y={y - 2.5}
                width="16"
                height="5"
                rx="2.5"
                className="fill-accent"
                opacity="0.7"
              />
            </g>
          );
        })}
      </svg>
      <p className="text-sm text-muted">{label}…</p>
      {shown.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Sheets">
          {shown.map((name, i) => (
            <li
              key={name}
              className="ledger-pulse rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-fg"
              style={{ '--i': i } as React.CSSProperties}
            >
              {name}
            </li>
          ))}
          {tabs.length > shown.length && (
            <li className="px-1 py-0.5 text-xs text-muted">+{tabs.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
