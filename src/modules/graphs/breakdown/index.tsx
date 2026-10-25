import { useMemo } from 'react';
import { categoryBreakdown } from '../../../lib/metrics/dashboard';
import { previousPeriod } from '../../../lib/metrics/period';
import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { CategoryBreakdown } from './CategoryBreakdown';

export const breakdownGraph: Graph = {
  kind: 'breakdown',
  title: 'Category breakdown',
  width: 2,
  View({ period, ledgers, accountIds, categories, ignoredCategories, colorOf, toggleCategory }) {
    const rows = useMemo(
      () => categoryBreakdown(ledgers, accountIds, period, ignoredCategories),
      [ledgers, accountIds, period, ignoredCategories]
    );
    if (!accountIds.length) return <NoData>No accounts switched on.</NoData>;
    return (
      <CategoryBreakdown
        rows={rows}
        chosen={categories}
        previous={previousPeriod(period)}
        colorOf={colorOf}
        onToggle={toggleCategory}
      />
    );
  },
};
