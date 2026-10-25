import { useMemo } from 'react';
import { buildMoneyFlow } from '../../../lib/paychecks/flow';
import type { Paycheck } from '../../../lib/paychecks/paychecks';
import type { AccountLedger } from '../../../lib/metrics/netWorth';
import type { Period } from '../../../lib/metrics/period';
import { formatMoney } from '../shared/format';
import { NoData } from '../shared/NoData';
import { SankeyChart } from './SankeyChart';

interface PaycheckFlowProps {
  ledgers: AccountLedger[];
  paychecks: readonly Paycheck[];
  period: Period;
  accountIds: number[];
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
  chosen: readonly string[];
  onToggleCategory(category: string): void;
}

/** The totals line and Sankey diagram for the paychecks in a period on into spending. */
export function PaycheckFlow({
  ledgers,
  paychecks,
  period,
  accountIds,
  ignoredCategories,
  colorOf,
  chosen,
  onToggleCategory,
}: PaycheckFlowProps) {
  const flow = useMemo(() => {
    return buildMoneyFlow({
      paychecks,
      ledgers,
      from: period.from,
      to: period.to,
      accountIds,
      ignoredCategories,
    });
  }, [accountIds, ledgers, paychecks, period, ignoredCategories]);

  if (!flow) return <NoData>No paychecks entered for this period.</NoData>;
  return (
    <>
      <p className="mb-3 text-sm text-muted tabular-nums">
        Gross {formatMoney(flow.totals.gross)} · Deductions {formatMoney(flow.totals.deductions)} ·
        Take-home {formatMoney(flow.totals.takeHome)}
        {' · '}Spent {formatMoney(flow.totals.spending)}
        {flow.totals.saved > 0 ? ` · Saved ${formatMoney(flow.totals.saved)}` : ''}
        {flow.totals.overspent > 0 ? ` · Overspent ${formatMoney(flow.totals.overspent)}` : ''}
      </p>
      <SankeyChart
        flow={flow}
        colorOf={colorOf}
        chosen={chosen}
        onToggleCategory={onToggleCategory}
      />
    </>
  );
}
