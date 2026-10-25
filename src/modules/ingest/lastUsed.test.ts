import { describe, expect, it } from 'vitest';
import { loadLastUsedIngest, rememberLastUsedIngest } from './lastUsed';
import { memoryStore } from './google/rememberedSpreadsheet';
import { INGEST_OPTIONS } from './index';

describe('last used ingest option', () => {
  it('is null until something is remembered', () => {
    expect(loadLastUsedIngest(memoryStore(), INGEST_OPTIONS)).toBeNull();
  });

  it('round-trips a known option id', () => {
    const store = memoryStore();
    rememberLastUsedIngest(store, 'upload');
    expect(loadLastUsedIngest(store, INGEST_OPTIONS)).toBe('upload');
  });

  it('ignores an id that is no longer an option', () => {
    const store = memoryStore();
    rememberLastUsedIngest(store, 'removed-option');
    expect(loadLastUsedIngest(store, INGEST_OPTIONS)).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberLastUsedIngest(broken, 'google')).not.toThrow();
    expect(loadLastUsedIngest(broken, INGEST_OPTIONS)).toBeNull();
  });
});
