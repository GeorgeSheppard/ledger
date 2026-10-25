import { useMemo } from 'react';
import { categoryBreakdown } from '../../../lib/metrics/dashboard';
import { comparisonPeriods, firstDate } from '../../../lib/metrics/period';
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
    const compared = useMemo(
      () => comparisonPeriods(period, firstDate(ledgers)),
      [ledgers, period]
    );
    if (!accountIds.length) return <NoData>No accounts switched on.</NoData>;
    return (
      <CategoryBreakdown
        rows={rows}
        chosen={categories}
        compared={compared}
        colorOf={colorOf}
        onToggle={toggleCategory}
      />
    );
  },
};
