import type { Meta, StoryObj } from '@storybook/react-vite';
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
