import { cn } from '../../ui/cn';

/**
 * Column layout shared by the transaction header, rows and inline editor: the five data columns
 * and the row's menu button.
 */
export const TRANSACTION_GRID =
  'grid grid-cols-[112px_minmax(120px,190px)_minmax(0,1fr)_120px_120px_32px] gap-2';

/** Heights of the windowed transaction list's items, which must match what the rows render. */
export const ROW_HEIGHT = { desktop: 44, mobile: 44 } as const;
export const MONTH_HEIGHT = 48;

/** A clickable list row that can be selected with J/K (transactions and categories). */
export function selectableRow(selected: boolean, className?: string) {
  return cn(
    'min-h-11 cursor-pointer items-center rounded-lg border-l-3 border-transparent px-3 text-sm transition-colors hover:bg-surface-hover',
    selected && 'border-accent bg-accent/10 hover:bg-accent/15',
    className
  );
}

/** The raised panel an inline editor sits in. */
export const EDITOR_PANEL = 'my-0.5 rounded-lg bg-surface shadow-lg ring-1 ring-accent';

/** Footer row of an inline editor: message on the left, buttons on the right. */
export const EDITOR_FOOTER =
  'flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2';
