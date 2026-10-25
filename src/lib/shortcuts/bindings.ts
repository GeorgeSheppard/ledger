/**
 * Every keyboard shortcut in the app, in one place, so features cannot collide and the help
 * overlay can list them all. Features reference shortcuts by id (`useShortcut('transactions.new')`)
 * and `<ActionButton shortcut="transactions.new">` shows the keys next to the button.
 *
 * Every shortcut is a single chord (one key, optionally with modifiers): no `g d` style sequences,
 * because there is no way to tell you are half way through one. Add new shortcuts to the section
 * for your feature. `shortcuts.test.ts` fails on duplicates.
 */

export type ShortcutScope =
  | 'global'
  | 'landing'
  | 'connect'
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'paychecks'
  | 'import';

export interface ShortcutBinding {
  keys: string;
  description: string;
  scope: ShortcutScope;
  /** Fire even while focus is in a text field (for save/cancel inside inline editors). */
  allowInInputs?: boolean;
}

export const SHORTCUTS = {
  // Global navigation (scaffold). Ctrl/⌘ chords so they never fire while typing a letter. Avoid
  // mod+N/T/W (the browser keeps them) and mod+C/V/X/Z/F/R/L/P (copy, find, reload and friends).
  'nav.dashboard': { keys: 'mod+d', description: 'Go to dashboard', scope: 'global' },
  'nav.accounts': { keys: 'mod+a', description: 'Go to accounts', scope: 'global' },
  'nav.categories': { keys: 'mod+k', description: 'Go to categories', scope: 'global' },
  'nav.paychecks': { keys: 'mod+y', description: 'Go to paychecks', scope: 'global' },
  'sync.save': {
    keys: 'mod+s',
    description: 'Save changes, or download the file',
    scope: 'global',
    allowInInputs: true,
  },

  // Dashboard (step 3)
  'dashboard.previousPeriod': {
    keys: '[',
    description: 'Previous period on the dashboard',
    scope: 'dashboard',
  },
  'dashboard.nextPeriod': {
    keys: ']',
    description: 'Next period on the dashboard',
    scope: 'dashboard',
  },
  'dashboard.backPeriod': {
    keys: 'b',
    description: 'Back to the dates you had before',
    scope: 'dashboard',
  },
  'dashboard.viewTransactions': {
    keys: 'v',
    description: 'View the transactions behind the dashboard',
    scope: 'dashboard',
  },

  // Accounts and transactions (step 2)
  'accounts.switch': { keys: '/', description: 'Switch account', scope: 'accounts' },
  'transactions.new': { keys: 'n', description: 'New transaction', scope: 'transactions' },
  'transactions.down': { keys: 'j', description: 'Next row', scope: 'transactions' },
  'transactions.up': { keys: 'k', description: 'Previous row', scope: 'transactions' },
  'transactions.edit': { keys: 'enter', description: 'Edit selected row', scope: 'transactions' },
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
    description: 'Delete selected rows',
    scope: 'transactions',
  },
  // The Delete key (and Backspace, which is what Delete is called on a Mac) do the same.
  'transactions.deleteKey': {
    keys: 'delete',
    description: 'Delete selected rows',
    scope: 'transactions',
  },
  'transactions.deleteBackspace': {
    keys: 'backspace',
    description: 'Delete selected rows',
    scope: 'transactions',
  },
  'transactions.selectAll': {
    keys: 'shift+a',
    description: 'Select every shown row',
    scope: 'transactions',
  },
  'transactions.search': { keys: 'f', description: 'Search transactions', scope: 'transactions' },

  // Paychecks
  'paychecks.new': { keys: 'n', description: 'Add a paycheck', scope: 'paychecks' },
  'paychecks.down': { keys: 'j', description: 'Next paycheck', scope: 'paychecks' },
  'paychecks.up': { keys: 'k', description: 'Previous paycheck', scope: 'paychecks' },
  'paychecks.edit': { keys: 'enter', description: 'Edit paycheck', scope: 'paychecks' },
  'paychecks.delete': {
    keys: 'mod+backspace',
    description: 'Delete paycheck',
    scope: 'paychecks',
  },
  'paychecks.save': {
    keys: 'mod+enter',
    description: 'Save paycheck',
    scope: 'paychecks',
    allowInInputs: true,
  },
  'paychecks.cancel': {
    keys: 'escape',
    description: 'Cancel editing',
    scope: 'paychecks',
    allowInInputs: true,
  },
  'paychecks.addIncome': {
    keys: 'alt+i',
    description: 'Add an income line',
    scope: 'paychecks',
    allowInInputs: true,
  },
  'paychecks.addBenefit': {
    keys: 'alt+b',
    description: 'Add a benefit in kind',
    scope: 'paychecks',
    allowInInputs: true,
  },
  'paychecks.addDeduction': {
    keys: 'alt+d',
    description: 'Add a deduction',
    scope: 'paychecks',
    allowInInputs: true,
  },
  'paychecks.removeLine': {
    keys: 'alt+backspace',
    description: 'Remove the line being edited',
    scope: 'paychecks',
    allowInInputs: true,
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

  // Import data dialog on an account page (step 4)
  'import.chooseFile': { keys: 'u', description: 'Choose CSV file', scope: 'import' },
  'import.confirm': {
    keys: 'mod+enter',
    description: 'Import transactions',
    scope: 'import',
    allowInInputs: true,
  },
  'import.paste': { keys: 'p', description: 'Paste text from your bank', scope: 'import' },
  'import.readPaste': { keys: 'r', description: 'Read the pasted text', scope: 'import' },
  'import.mapping': { keys: 'm', description: 'Edit column mapping', scope: 'import' },
  'import.invert': { keys: 'i', description: 'Flip amount signs', scope: 'import' },
  'import.filter': { keys: 'f', description: 'Cycle preview filter', scope: 'import' },
  'import.reset': {
    keys: 'x',
    description: 'Start over with another file or text',
    scope: 'import',
  },
  'import.close': {
    keys: 'escape',
    description: 'Close import',
    scope: 'import',
    allowInInputs: true,
  },
} as const satisfies Record<string, ShortcutBinding>;

export type ShortcutId = keyof typeof SHORTCUTS;

export function getBinding(id: ShortcutId): ShortcutBinding {
  return SHORTCUTS[id];
}
