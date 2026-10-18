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

/** The stored metric, or net worth when it is missing or from a version that no longer exists. */
export function statMetric(value: string): StatMetric {
  return (STAT_METRICS as readonly string[]).includes(value) ? (value as StatMetric) : 'netWorth';
}
