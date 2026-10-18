export function NoData({ children }: { children: string }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** Shown by graphs of income and spending when the period holds balances but no income or spending. */
export const NO_ACTIVITY =
  'No income or spending in this period. Try a longer range, or check that these accounts have transactions in it.';
