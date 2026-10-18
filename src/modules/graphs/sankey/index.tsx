import { useMemo } from 'react';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { buildMoneyFlow, flowWindow } from '../../../lib/paychecks/flow';
import { todayIso } from '../../../lib/transactions/dates';
import type { Graph } from '../types';
import { formatMoney } from '../shared/format';
import { NoData } from '../shared/NoData';
import { SankeyChart } from './SankeyChart';

export const sankeyGraph: Graph = {
  kind: 'sankey',
  label: 'Money flow from paychecks (Sankey)',
  defaultWidth: 4,
  title: () => 'Where your money goes',
  View({ widget, ledgers, paychecks, range, colorOf }) {
    const flow = useMemo(() => {
      const { from, to } = flowWindow(ledgers, paychecks, range, todayIso());
      return buildMoneyFlow({ paychecks, ledgers, from, to, accountIds: widget.accounts });
    }, [widget.accounts, ledgers, paychecks, range]);

    if (paychecks.length === 0)
      return (
        <p className="text-sm text-muted">
          Add your paychecks to follow your money from gross pay to spending.{' '}
          <Link to={paths.paychecks} className="text-accent">
            Add a paycheck
          </Link>
        </p>
      );
    if (!flow) return <NoData>No paychecks pay into these accounts in this period.</NoData>;
    return (
      <>
        <p className="mb-3 text-sm text-muted tabular-nums">
          Gross {formatMoney(flow.totals.gross)} · Deductions {formatMoney(flow.totals.deductions)}{' '}
          · Take-home {formatMoney(flow.totals.takeHome)} · Spent{' '}
          {formatMoney(flow.totals.spending)}
        </p>
        <SankeyChart flow={flow} colorOf={colorOf} />
      </>
    );
  },
};
