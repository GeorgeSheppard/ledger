/** Running balance after each amount, in order. Rounded to cents to avoid float drift. */
export function runningTotals(amounts: readonly number[]): number[] {
  let total = 0;
  return amounts.map((amount) => {
    total = Math.round((total + amount) * 100) / 100;
    return total;
  });
}
