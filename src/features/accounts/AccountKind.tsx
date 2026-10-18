/**
 * Whether the account is a credit card or loan. Those tabs record amounts from the account's own
 * side (a purchase is positive), so Ledger flips the sign when it counts the money. Lives in the
 * account header, apart from the transaction table.
 */
export function AccountKind({
  inverted,
  onChange,
}: {
  inverted: boolean;
  onChange: (inverted: boolean) => void;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-accent"
        checked={inverted}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">Credit card or loan</span>
        <span className="block text-xs text-muted">
          {inverted
            ? 'Amounts in the sheet are from the account’s side: a purchase is positive. Ledger counts them as money out and the balance as what you owe.'
            : 'Tick this if purchases are positive in this tab, so the balance counts against your net worth.'}
        </span>
      </span>
    </label>
  );
}
