import { useState } from 'react';
import { INGEST_OPTIONS } from '../../modules/ingest';
import { loadLastUsedIngest, rememberLastUsedIngest } from '../../modules/ingest/lastUsed';
import { browserStore } from '../../modules/ingest/google/rememberedSpreadsheet';

/** The id of the ingest option the user used last time, and a way to record a new one. */
export function useLastUsedIngest() {
  const [store] = useState(() => browserStore('local'));
  const [lastUsed, setLastUsed] = useState(() => loadLastUsedIngest(store, INGEST_OPTIONS));
  return {
    lastUsed,
    markUsed(id: string) {
      rememberLastUsedIngest(store, id);
      setLastUsed(id);
    },
  };
}
