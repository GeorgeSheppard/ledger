import { useCallback, useMemo } from 'react';
import type { DashboardConfig } from '../../lib/dashboard/config';
import { defaultDashboard } from '../../modules/graphs';
import { parsePaychecks } from '../../lib/paychecks/serialize';
import { parseDashboard, serializeDashboard } from '../../lib/dashboard/serialize';
import type { JsonValue } from '../../lib/store/ledgerData';
import { useLedger, useRepository } from '../../state/ledgerData';
import { useLedgers } from './loadLedgers';

/**
 * The one place the dashboard touches the data layer: the ledgers, plus the layout stored in the
 * `_Dashboard` tab and the paychecks the money-flow graph follows (the default layout until the user saves one). Saving the layout goes through
 * the store like any other edit, so it reaches the sheet with the next save.
 */
export function useDashboardData() {
  const query = useLedgers();
  const { dashboard, paychecks: storedPaychecks } = useLedger();
  const repository = useRepository();
  const layout = useMemo<DashboardConfig>(
    () => parseDashboard(dashboard) ?? defaultDashboard(),
    [dashboard]
  );
  const paychecks = useMemo(() => parsePaychecks(storedPaychecks).paychecks, [storedPaychecks]);
  const saveLayout = useCallback(
    (config: DashboardConfig) =>
      repository.saveDashboardConfig(serializeDashboard(config) as unknown as JsonValue),
    [repository]
  );
  return { query, layout, saveLayout, paychecks };
}
