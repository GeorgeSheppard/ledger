/**
 * Every keyboard shortcut in the app, in one place, so features cannot collide and the help
 * overlay can list them all. Features reference shortcuts by id (`useShortcut('transactions.new')`)
 * and `<ActionButton shortcut="transactions.new">` shows the keys next to the button.
 *
 * Add new shortcuts to the section for your feature. `bindings.test.ts` fails on duplicates.
 */

export type ShortcutScope =
  | 'global'
  | 'landing'
  | 'connect'
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'import';

export interface ShortcutBinding {
  keys: string;
  description: string;
  scope: ShortcutScope;
  /** Fire even while focus is in a text field (for save/cancel inside inline editors). */
  allowInInputs?: boolean;
}

export const SHORTCUTS = {
  // Global navigation (scaffold)
  'nav.dashboard': { keys: 'g d', description: 'Go to dashboard', scope: 'global' },
  'nav.accounts': { keys: 'g a', description: 'Go to accounts', scope: 'global' },
  'nav.categories': { keys: 'g c', description: 'Go to categories', scope: 'global' },
  'nav.import': { keys: 'g i', description: 'Go to CSV import', scope: 'global' },
  'help.toggle': { keys: '?', description: 'Show keyboard shortcuts', scope: 'global' },

  // Landing and connect (step 1)
  'landing.signIn': { keys: 'enter', description: 'Sign in with Google', scope: 'landing' },
  'connect.pick': { keys: 'o', description: 'Open an existing spreadsheet', scope: 'connect' },
  'connect.create': { keys: 'c', description: 'Create a new spreadsheet', scope: 'connect' },
  'connect.back': { keys: 'escape', description: 'Back to your dashboard', scope: 'connect' },
  'connect.signOut': { keys: 'shift+q', description: 'Sign out', scope: 'connect' },

  // Dashboard (step 3)
  'dashboard.range3': { keys: '1', description: 'Show last 3 months', scope: 'dashboard' },
  'dashboard.range6': { keys: '2', description: 'Show last 6 months', scope: 'dashboard' },
  'dashboard.range12': { keys: '3', description: 'Show last 12 months', scope: 'dashboard' },
  'dashboard.rangeAll': { keys: '4', description: 'Show all months', scope: 'dashboard' },
  'dashboard.previousMonth': {
    keys: '[',
    description: 'Previous month in breakdown',
    scope: 'dashboard',
  },
  'dashboard.nextMonth': { keys: ']', description: 'Next month in breakdown', scope: 'dashboard' },

  // Accounts and transactions (step 2)
  'accounts.switch': { keys: '/', description: 'Switch account', scope: 'accounts' },
  'accounts.previous': { keys: '[', description: 'Previous account', scope: 'accounts' },
  'accounts.next': { keys: ']', description: 'Next account', scope: 'accounts' },
  'accounts.new': { keys: 'shift+n', description: 'New account', scope: 'accounts' },
  'accounts.rename': { keys: 'r', description: 'Rename account', scope: 'accounts' },
  'transactions.new': { keys: 'n', description: 'New transaction', scope: 'transactions' },
  'transactions.down': { keys: 'j', description: 'Next row', scope: 'transactions' },
  'transactions.up': { keys: 'k', description: 'Previous row', scope: 'transactions' },
  'transactions.edit': { keys: 'enter', description: 'Edit row', scope: 'transactions' },
  'transactions.save': {
    keys: 'mod+enter',
    description: 'Save row',
    scope: 'transactions',
    allowInInputs: true,
  },
  'transactions.cancel': {
    keys: 'escape',
    description: 'Cancel editing',
    scope: 'transactions',
    allowInInputs: true,
  },
  'transactions.delete': {
    keys: 'mod+backspace',
    description: 'Delete row',
    scope: 'transactions',
  },

  // Categories (step 2)
  'categories.new': { keys: 'c', description: 'New category', scope: 'categories' },
  'categories.down': { keys: 'j', description: 'Next category', scope: 'categories' },
  'categories.up': { keys: 'k', description: 'Previous category', scope: 'categories' },
  'categories.moveDown': {
    keys: 'shift+j',
    description: 'Move category down',
    scope: 'categories',
  },
  'categories.moveUp': { keys: 'shift+k', description: 'Move category up', scope: 'categories' },
  'categories.edit': { keys: 'enter', description: 'Edit category', scope: 'categories' },
  'categories.save': {
    keys: 'mod+enter',
    description: 'Save category',
    scope: 'categories',
    allowInInputs: true,
  },
  'categories.cancel': {
    keys: 'escape',
    description: 'Cancel editing',
    scope: 'categories',
    allowInInputs: true,
  },
  'categories.delete': {
    keys: 'mod+backspace',
    description: 'Delete category',
    scope: 'categories',
  },

  // CSV import (step 4)
  'import.chooseFile': { keys: 'u', description: 'Choose CSV file', scope: 'import' },
  'import.confirm': {
    keys: 'mod+enter',
    description: 'Import transactions',
    scope: 'import',
    allowInInputs: true,
  },
  'import.account': { keys: 'a', description: 'Choose account to import into', scope: 'import' },
  'import.mapping': { keys: 'm', description: 'Edit column mapping', scope: 'import' },
  'import.invert': { keys: 'i', description: 'Flip amount signs', scope: 'import' },
  'import.filter': { keys: 'f', description: 'Cycle preview filter', scope: 'import' },
  'import.reset': { keys: 'x', description: 'Start over with another file', scope: 'import' },
} as const satisfies Record<string, ShortcutBinding>;

export type ShortcutId = keyof typeof SHORTCUTS;

export function getBinding(id: ShortcutId): ShortcutBinding {
  return SHORTCUTS[id];
}
