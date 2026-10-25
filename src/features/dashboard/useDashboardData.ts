import { useMemo } from 'react';
import { parsePaychecks } from '../../lib/paychecks/serialize';
import { useLedger } from '../../state/ledgerData';
import { useLedgers } from './loadLedgers';

/**
 * The one place the dashboard touches the data layer: the ledgers, plus the paychecks the
 * money-flow graph follows. The layout saved in the `_Dashboard` tab is left alone (and kept in the
 * sheet) while the dashboard has a fixed layout.
 */
export function useDashboardData() {
  const query = useLedgers();
  const { paychecks: storedPaychecks } = useLedger();
  const paychecks = useMemo(() => parsePaychecks(storedPaychecks).paychecks, [storedPaychecks]);
  return { query, paychecks };
}
