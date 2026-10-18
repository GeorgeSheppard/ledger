import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { AppProviders, SignedIn } from '../../storybook/providers';
import { LandingPage } from '../landing/LandingPage';
import { ConnectPage } from './ConnectPage';

const meta = { title: 'Pages/Connect' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Shown after signing in, before a spreadsheet is chosen. */
export const ChooseSpreadsheet: Story = {
  render: () => (
    <SignedIn>
      <ConnectPage />
    </SignedIn>
  ),
};

export const Landing: Story = {
  render: () => (
    <AppProviders>
      <LandingPage />
    </AppProviders>
  ),
};

/** "Get started" on the homepage opens the multiple-choice dialog. */
export const GetStarted: Story = {
  render: () => (
    <AppProviders>
      <LandingPage />
    </AppProviders>
  ),
  play: async ({ canvasElement }) => {
    const [button] = await within(canvasElement).findAllByRole('button', { name: /get started/i });
    await userEvent.click(button!);
  },
};

/** After choosing "Upload a spreadsheet": that option's steps. */
export const GetStartedUpload: Story = {
  ...GetStarted,
  play: async (context) => {
    await GetStarted.play?.(context);
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('button', { name: /upload a spreadsheet/i })
    );
  },
};
