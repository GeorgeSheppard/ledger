import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { PaycheckFlow } from './PaycheckFlow';

export const sankeyGraph: Graph = {
  kind: 'sankey',
  title: 'Where your money goes',
  width: 4,
  View({
    period,
    ledgers,
    paychecks,
    accountIds,
    categories,
    ignoredCategories,
    colorOf,
    toggleCategory,
  }) {
    if (paychecks.length === 0)
      return (
        <p className="text-sm text-muted">
          Enter your payslips to follow your money from gross pay to spending.{' '}
          <Link to={paths.paychecks} className="text-accent">
            Add a paycheck
          </Link>
        </p>
      );
    if (!accountIds.length) return <NoData>No accounts switched on.</NoData>;
    return (
      <PaycheckFlow
        ledgers={ledgers}
        paychecks={paychecks}
        period={period}
        accountIds={accountIds}
        ignoredCategories={ignoredCategories}
        colorOf={colorOf}
        chosen={categories}
        onToggleCategory={toggleCategory}
      />
    );
  },
};
