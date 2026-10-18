import type { IsoDate } from '../domain/types';
import { noFilters, type AmountSign, type TransactionFilters } from './filters';

/**
 * The filters a link can carry to the transactions page, so a graph can open "the transactions
 * behind this". Only date range, categories, accounts and direction (money in or out) travel; `''` (no category) is sent as an empty `cat`.
 */
export type LinkedFilters = Partial<
  Pick<TransactionFilters, 'from' | 'to' | 'categories' | 'accounts' | 'sign'>
>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The query string (without `?`) for `filters`; empty when there is nothing to carry. */
export function filterParams({ from, to, categories, accounts, sign }: LinkedFilters): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  for (const category of categories ?? []) params.append('cat', category);
  for (const id of accounts ?? []) params.append('acct', String(id));
  if (sign === 'in' || sign === 'out') params.set('sign', sign);
  return params.toString();
}

function dateParam(value: string | null): IsoDate | null {
  return value && ISO.test(value) ? value : null;
}

function signParam(value: string | null): AmountSign {
  return value === 'in' || value === 'out' ? value : 'any';
}

/** Filters from the URL. Unknown or malformed parameters are ignored. */
export function filtersFromParams(params: URLSearchParams): TransactionFilters {
  return {
    ...noFilters,
    from: dateParam(params.get('from')),
    to: dateParam(params.get('to')),
    categories: params.getAll('cat'),
    accounts: params.getAll('acct').map(Number).filter(Number.isInteger),
    sign: signParam(params.get('sign')),
  };
}

/** The transactions page's URL showing every transaction in `category`, whatever its date or account. */
export function categoryTransactionsPath(basePath: string, category: string): string {
  return `${basePath}?${filterParams({ categories: [category] })}`;
}
