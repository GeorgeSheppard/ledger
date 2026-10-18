export const STAT_METRICS = [
  'netWorth',
  'spending',
  'income',
  'savingsRate',
  'averageSpending',
] as const;
export type StatMetric = (typeof STAT_METRICS)[number];

export const METRIC_LABELS: Record<StatMetric, string> = {
  netWorth: 'Net worth',
  spending: 'Spending in the latest month',
  income: 'Income in the latest month',
  savingsRate: 'Share of income saved',
  averageSpending: 'Average monthly spending',
};

/** Titles for a number shown over time, where "in the latest month" no longer applies. */
export const CHART_TITLES: Record<StatMetric, string> = {
  netWorth: 'Net worth over time',
  spending: 'Spending by period',
  income: 'Income by period',
  savingsRate: 'Share of income saved over time',
  averageSpending: 'Spending by period, against the average',
};

/** The stored metric, or net worth when it is missing or from a version that no longer exists. */
export function statMetric(value: string): StatMetric {
  return (STAT_METRICS as readonly string[]).includes(value) ? (value as StatMetric) : 'netWorth';
}

/** Which direction of money a number is made of, or null when it is a total with no rows behind it. */
export function statSign(metric: StatMetric): 'in' | 'out' | 'any' | null {
  switch (metric) {
    case 'netWorth':
      return null;
    case 'income':
      return 'in';
    case 'spending':
    case 'averageSpending':
      return 'out';
    case 'savingsRate':
      return 'any';
  }
}

/**
 * The categories the transactions behind an income or spending number come from: every category
 * in `transactions` except the ones the user excluded (lower-cased names). Empty when none are
 * excluded, which means "all" to the transactions list. No category is written as `uncategorised`.
 */
export function includedCategories(
  transactions: readonly { category: string }[],
  ignoredCategories: ReadonlySet<string>,
  uncategorised: string
): string[] {
  const names = new Set(transactions.map((t) => t.category));
  const kept = [...names].filter((c) => !ignoredCategories.has(c.trim().toLowerCase()));
  if (kept.length === names.size) return [];
  return kept.map((c) => c || uncategorised).sort();
}
