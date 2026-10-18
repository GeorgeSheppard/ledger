import { useCallback, useState } from 'react';
import { defaultDashboard, type DashboardConfig } from '../../lib/dashboard/config';
import { useLedgerQuery } from '../../state/ledgerData';
import { loadDashboardData } from './loadLedgers';

/**
 * TEMPORARY: the one place the dashboard touches the data layer. Will switch to `useLedger()` and
 * `saveDashboardConfig` from the new store once it lands; until then the layout lives in memory.
 */
export function useDashboardData() {
  const query = useLedgerQuery(loadDashboardData);
  const [layout, setLayout] = useState<DashboardConfig>(defaultDashboard);
  const saveLayout = useCallback(async (config: DashboardConfig) => setLayout(config), []);
  return { query, layout, saveLayout };
}
