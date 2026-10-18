import { useMemo } from 'react';
import {
  addCategory,
  moveCategory,
  recolorCategory,
  setCategoryExcluded,
  removeCategory,
  sameName,
} from '../../lib/categories/categories';
import { respreadColors } from '../../lib/categories/palette';
import type { Category } from '../../lib/domain/types';
import { countUsage } from '../../lib/categories/categories';
import { useLedger, useLedgerMutation, type QueryState } from '../../state/ledgerData';

/** The category list plus how many transactions (across all accounts) use each name. */
export function useCategoriesWithUsage(): QueryState<{
  categories: Category[];
  usage: ReturnType<typeof countUsage>;
}> {
  const { categories, transactionsByAccount } = useLedger();
  return useMemo(
    () => ({
      status: 'ready',
      data: { categories, usage: countUsage(Object.values(transactionsByAccount).flat()) },
    }),
    [categories, transactionsByAccount]
  );
}

/** Category writes. Each reads the current list first so concurrent edits are not lost. */
export function useCategoryActions() {
  const mutate = useLedgerMutation();
  return useMemo(() => {
    const update = (change: (list: Category[]) => Category[]) =>
      mutate(async (r) => r.saveCategories(change(await r.listCategories())));
    return {
      add: (name: string, color: string, excluded = false) =>
        update((list) => addCategory(list, name, color, excluded)),
      /** Gives every category a clearly different palette colour. */
      spreadColors: () => update(respreadColors),
      remove: (name: string) => update((list) => removeCategory(list, name)),
      move: (name: string, delta: number) => update((list) => moveCategory(list, name, delta)),
      /** Renames (rewriting every transaction that used the old name) and/or recolours. */
      edit: (original: Category, next: Category) =>
        mutate(async (r) => {
          if (next.name !== original.name) await r.renameCategory(original.name, next.name);
          if (next.color.toLowerCase() !== original.color.toLowerCase()) {
            const list = await r.listCategories();
            const name = list.find((c) => sameName(c.name, next.name))?.name ?? next.name;
            await r.saveCategories(recolorCategory(list, name, next.color));
          }
          if (!!next.excluded !== !!original.excluded) {
            const list = await r.listCategories();
            const name = list.find((c) => sameName(c.name, next.name))?.name ?? next.name;
            await r.saveCategories(setCategoryExcluded(list, name, !!next.excluded));
          }
        }),
    };
  }, [mutate]);
}
