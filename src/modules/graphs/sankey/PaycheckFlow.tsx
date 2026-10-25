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
  accountIds?: number[];
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
}

/** The totals line and Sankey diagram for the paychecks in a period; shared by the dashboard widget and the Paychecks page. */
export function PaycheckFlow({
  ledgers,
  paychecks,
  period,
  accountIds,
  ignoredCategories,
  colorOf,
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
        Take-home {formatMoney(flow.totals.takeHome)} · Spent {formatMoney(flow.totals.spending)}
      </p>
      <SankeyChart flow={flow} colorOf={colorOf} />
    </>
  );
}
