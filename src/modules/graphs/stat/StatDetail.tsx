import { UNCATEGORISED } from '../../../lib/metrics/cashFlow';
import { Dialog } from '../../../ui/Dialog';
import type { GraphViewProps } from '../types';
import { NoData } from '../shared/NoData';
import { useTimeSeries } from '../shared/useTimeSeries';
import { ViewTransactions } from '../shared/ViewTransactions';
import { CHART_TITLES, includedCategories, statSign, type StatMetric } from './metrics';
import { StatChart } from './StatChart';

/**
 * A headline number as a graph over time, opened by clicking its tile. "View transactions" opens
 * the rows the number is made of for the dates on screen, leaving out excluded categories. A total
 * such as net worth has no rows of its own, so it has no button.
 */
export function StatDetail({
  metric,
  props,
  onClose,
}: {
  metric: StatMetric;
  props: GraphViewProps;
  onClose(): void;
}) {
  const series = useTimeSeries(props);
  const { dashboard, ledgers, accountIds, ignoredCategories } = props;
  const sign = statSign(metric);
  const covered = ledgers
    .filter((l) => accountIds.includes(l.account.id))
    .flatMap((l) => l.transactions);
  const categories =
    sign === null ? [] : includedCategories(covered, ignoredCategories, UNCATEGORISED);

  return (
    <Dialog
      title={CHART_TITLES[metric]}
      onClose={onClose}
      className="w-[min(56rem,calc(100vw-32px))]"
    >
      {dashboard && series ? (
        <StatChart
          metric={metric}
          series={series}
          average={dashboard.latest.averageSpending}
          toolbar={({ dates }) =>
            sign && (
              <ViewTransactions
                ledgers={ledgers}
                accountIds={accountIds}
                {...dates}
                categories={categories}
                sign={sign}
                open={props.openTransactions}
              />
            )
          }
        />
      ) : (
        <NoData>No transactions in these accounts yet.</NoData>
      )}
    </Dialog>
  );
}
