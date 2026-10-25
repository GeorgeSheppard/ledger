import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import type { Graph } from '../types';
import { PaycheckFlow } from './PaycheckFlow';

export const sankeyGraph: Graph = {
  kind: 'sankey',
  label: 'Money flow from paychecks (Sankey)',
  defaultWidth: 4,
  title: () => 'Where your money goes',
  View({ widget, ledgers, paychecks, range, ignoredCategories, colorOf }) {
    if (paychecks.length === 0)
      return (
        <p className="text-sm text-muted">
          Enter your payslips to follow your money from gross pay to spending.{' '}
          <Link to={paths.paychecks} className="text-accent">
            Add a paycheck
          </Link>
        </p>
      );
    return (
      <PaycheckFlow
        ledgers={ledgers}
        paychecks={paychecks}
        range={range}
        accountIds={widget.accounts}
        ignoredCategories={ignoredCategories}
        colorOf={colorOf}
      />
    );
  },
};
