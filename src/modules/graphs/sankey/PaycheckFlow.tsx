import { useMemo } from 'react';
import { buildMoneyFlow, flowWindow } from '../../../lib/paychecks/flow';
import type { Paycheck } from '../../../lib/paychecks/paychecks';
import type { DashboardRange } from '../../../lib/metrics/dashboard';
import type { AccountLedger } from '../../../lib/metrics/netWorth';
import { todayIso } from '../../../lib/transactions/dates';
import { formatMoney } from '../shared/format';
import { NoData } from '../shared/NoData';
import { SankeyChart } from './SankeyChart';

interface PaycheckFlowProps {
  ledgers: AccountLedger[];
  paychecks: readonly Paycheck[];
  range: DashboardRange;
  accountIds?: number[];
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
}

/** The totals line and Sankey diagram for the paychecks in a range; shared by the dashboard widget and the Paychecks page. */
export function PaycheckFlow({
  ledgers,
  paychecks,
  range,
  accountIds,
  ignoredCategories,
  colorOf,
}: PaycheckFlowProps) {
  const flow = useMemo(() => {
    const { from, to } = flowWindow(ledgers, paychecks, range, todayIso());
    return buildMoneyFlow({ paychecks, ledgers, from, to, accountIds, ignoredCategories });
  }, [accountIds, ledgers, paychecks, range, ignoredCategories]);

  if (!flow) return <NoData>No paychecks entered for this period.</NoData>;
  return (
    <>
      <p className="mb-3 text-sm text-muted tabular-nums">
        Gross {formatMoney(flow.totals.gross)} · Deductions {formatMoney(flow.totals.deductions)} ·
        Take-home {formatMoney(flow.totals.takeHome)} · Spent {formatMoney(flow.totals.spending)}
      </p>
      <SankeyChart flow={flow} colorOf={colorOf} />
    </>
  );
}
