/** Every URL in the app. Link with these helpers rather than string literals. */
export const paths = {
  home: '/',
  connect: '/connect',
  accounts: '/accounts',
  account: (accountId: number) => `/accounts/${accountId}`,
  categories: '/categories',
  import: '/import',
  privacy: '/privacy',
  terms: '/terms',
} as const;
