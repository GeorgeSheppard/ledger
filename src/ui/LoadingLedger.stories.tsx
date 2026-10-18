import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingLedger } from './LoadingLedger';

const meta = {
  title: 'UI/Loading',
  component: LoadingLedger,
  decorators: [
    (Story) => (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-6 text-fg">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoadingLedger>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the tab list has come back. The ledger rows write themselves in on a loop. */
export const Opening: Story = { args: { title: 'Household finances' } };

/** The tabs are known and being read; each chip pulses in turn. */
export const ReadingSheets: Story = {
  args: {
    title: 'Household finances',
    progress: {
      step: 'values',
      tabs: [
        'Current account',
        'Savings',
        'Credit card',
        'ISA',
        'Pension',
        'Mortgage',
        'Paychecks',
      ],
    },
  },
};

/** A big spreadsheet: the first few tabs are named, the rest are counted. */
export const ManySheets: Story = {
  args: {
    title: 'Household finances',
    progress: {
      step: 'values',
      tabs: Array.from({ length: 14 }, (_, i) => `Account ${i + 1}`),
    },
  },
};
