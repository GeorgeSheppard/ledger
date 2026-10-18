import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';

/** A static illustration of a Ledger account tab, so visitors can see what their sheet will hold. */
const ROWS = [
  {
    date: '2026-09-25',
    category: 'Income',
    color: '#2f9e6b',
    amount: 2850,
    total: 3412.6,
    note: 'Payroll',
  },
  {
    date: '2026-09-26',
    category: 'Housing',
    color: '#d9534f',
    amount: -1100,
    total: 2312.6,
    note: 'Rent',
  },
  {
    date: '2026-09-27',
    category: 'Groceries',
    color: '#4f7cff',
    amount: -64.2,
    total: 2248.4,
    note: 'Supermarket',
  },
  {
    date: '2026-09-29',
    category: 'Transport',
    color: '#8e6bd6',
    amount: -42,
    total: 2206.4,
    note: 'Travel card',
  },
  {
    date: '2026-10-01',
    category: 'Eating out',
    color: '#e8913a',
    amount: -28.5,
    total: 2177.9,
    note: 'Dinner',
  },
];

const money = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const TABS = ['Current account', 'Savings', 'Credit card'];
const CELL = 'border-b border-line px-3 py-2 whitespace-nowrap max-sm:px-1.5';

export function SheetPreview() {
  return (
    <Card
      className="overflow-x-auto shadow-lg"
      role="figure"
      aria-label="Example of a Ledger account sheet"
    >
      <div className="flex gap-1 border-b border-line bg-canvas px-3 pt-2" aria-hidden="true">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className={cn(
              'rounded-t px-3 py-1.5 text-xs text-muted',
              i === 0 && 'bg-surface font-semibold text-fg shadow-[inset_0_-2px_0] shadow-accent'
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className={cn(CELL, 'font-semibold')}>Date</th>
            <th className={cn(CELL, 'font-semibold')}>Category</th>
            <th className={cn(CELL, 'text-right font-semibold')}>Amount</th>
            <th className={cn(CELL, 'font-semibold max-sm:hidden')}>Note</th>
            <th className={cn(CELL, 'text-right font-semibold')}>Total</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.date}>
              <td className={cn(CELL, 'tabular-nums')}>{row.date}</td>
              <td className={CELL}>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ color: row.color, backgroundColor: `${row.color}24` }}
                >
                  {row.category}
                </span>
              </td>
              <td
                className={cn(
                  CELL,
                  'text-right tabular-nums',
                  row.amount >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                {money.format(row.amount)}
              </td>
              <td className={cn(CELL, 'max-sm:hidden')}>{row.note}</td>
              <td className={cn(CELL, 'text-right tabular-nums')}>{money.format(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted">One tab per account, in your Google Drive.</p>
    </Card>
  );
}
