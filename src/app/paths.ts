/** Every URL in the app. Link with these helpers rather than string literals. */
export const paths = {
  home: '/',
  connect: '/connect',
  accounts: '/accounts',
  account: (accountId: number) => `/accounts/${accountId}`,
  transactions: '/transactions',
  categories: '/categories',
  paychecks: '/paychecks',
  import: '/import',
  privacy: '/privacy',
  terms: '/terms',
} as const;
