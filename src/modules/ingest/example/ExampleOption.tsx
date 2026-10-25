import type { IngestOption } from '../types';

export const exampleOption: IngestOption = {
  id: 'example',
  title: 'Explore an example',
  description:
    'Look around a made-up ledger with a year of transactions first. Nothing to sign in to or upload; Download gives it as a spreadsheet.',
  openDirectly: (session) => session.startExample(),
};
