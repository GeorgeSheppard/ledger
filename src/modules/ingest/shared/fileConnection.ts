import type { RemoteState } from '../../../lib/store/remote';
import { fileSaver } from '../../save';
import type { Connection } from '../types';

/** A ledger held in memory from `state`, saved by downloading a file. */
export function fileConnection(
  title: string,
  state: RemoteState,
  original: ArrayBuffer | null
): Connection {
  return {
    title,
    load: async () => structuredClone(state),
    saver: fileSaver(
      title,
      state.data.accounts.map((account) => account.id),
      original
    ),
  };
}
