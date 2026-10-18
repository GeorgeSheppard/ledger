import { describe, expect, it } from 'vitest';
import {
  forgetSpreadsheet,
  loadRememberedSpreadsheet,
  memoryStore,
  rememberSpreadsheet,
} from './rememberedSpreadsheet';

describe('remembered spreadsheet', () => {
  it('round-trips the id and title', () => {
    const store = memoryStore();
    expect(loadRememberedSpreadsheet(store)).toBeNull();
    rememberSpreadsheet(store, { id: 'abc', title: 'My money' });
    expect(loadRememberedSpreadsheet(store)).toEqual({ id: 'abc', title: 'My money' });
    forgetSpreadsheet(store);
    expect(loadRememberedSpreadsheet(store)).toBeNull();
  });

  it('ignores corrupt or malformed values', () => {
    const store = memoryStore();
    store.setItem('ledger.spreadsheet', '{not json');
    expect(loadRememberedSpreadsheet(store)).toBeNull();
    store.setItem('ledger.spreadsheet', JSON.stringify({ id: '', title: 'x' }));
    expect(loadRememberedSpreadsheet(store)).toBeNull();
  });
});
