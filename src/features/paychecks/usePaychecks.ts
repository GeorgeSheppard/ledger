import { useCallback, useMemo } from 'react';
import type { PaycheckList } from '../../lib/paychecks/paychecks';
import { parsePaychecks, serializePaychecks } from '../../lib/paychecks/serialize';
import type { JsonValue } from '../../lib/store/ledgerData';
import { useLedger, useRepository } from '../../state/ledgerData';

/**
 * The one place the paychecks page touches the data layer: the list stored in the `_Paychecks` tab.
 * Older data is converted when read (see `lib/paychecks/legacy.ts`). Saving goes through the store
 * like any other edit, so it reaches the sheet with the next save.
 */
export function usePaychecks(): { list: PaycheckList; save(list: PaycheckList): Promise<void> } {
  const { paychecks } = useLedger();
  const repository = useRepository();
  const list = useMemo(() => parsePaychecks(paychecks), [paychecks]);
  const save = useCallback(
    (next: PaycheckList) =>
      repository.savePaychecks(serializePaychecks(next) as unknown as JsonValue),
    [repository]
  );
  return { list, save };
}
