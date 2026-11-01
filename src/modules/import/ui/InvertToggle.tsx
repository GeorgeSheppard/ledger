import type { TransactionInput } from '../../../lib/domain/types';
import { useShortcut } from '../../../state/shortcuts';
import { Card } from '../../../ui/Card';
import { Kbd } from '../../../ui/Kbd';
import { formatAmount } from './format';

/** Money in and out of the rows about to be added, as they will be stored. */
export function incomingTotals(rows: readonly TransactionInput[]) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const row of rows) {
    if (row.amount > 0) moneyIn += row.amount;
    else moneyOut += row.amount;
  }
  return { moneyIn: Math.round(moneyIn * 100) / 100, moneyOut: Math.round(moneyOut * 100) / 100 };
}

/**
 * "Invert amounts" for everything being imported, whether it came from a CSV or pasted text. Ledger
 * stores positive as money in and negative as money out, so a file that writes spending as positive
 * (credit cards often do) needs this on. The totals update as it is switched, so it is easy to see
 * which way round is right.
 */
export function InvertToggle({
  inverted,
  onChange,
  toAdd,
}: {
  inverted: boolean;
  onChange(inverted: boolean): void;
  toAdd: readonly TransactionInput[];
}) {
  useShortcut('import.invert', () => onChange(!inverted));
  const { moneyIn, moneyOut } = incomingTotals(toAdd);
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
      <label className="inline-flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          className="accent-accent"
          checked={inverted}
          onChange={(e) => onChange(e.target.checked)}
        />
        Invert amounts
        <Kbd shortcut="import.invert" className="text-muted" />
      </label>
      <span className="text-muted">
        Positive amounts are money in. Tick this if your file shows spending as positive.
      </span>
      {toAdd.length > 0 && (
        <span className="ml-auto tabular-nums" aria-live="polite">
          New rows: <span className="text-positive">{formatAmount(moneyIn)}</span> in ·{' '}
          <span className="text-negative">{formatAmount(moneyOut)}</span> out
        </span>
      )}
    </Card>
  );
}
