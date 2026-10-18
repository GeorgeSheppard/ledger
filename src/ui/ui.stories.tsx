import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppProviders } from '../storybook/providers';
import { ActionButton } from './ActionButton';
import { Badge } from './Badge';
import { Card } from './Card';
import { Kbd } from './Kbd';
import { Page } from './Page';
import { Select } from './Select';
import { TextInput } from './TextInput';

const meta = {
  title: 'UI/Shared components',
  decorators: [
    (Story) => (
      <AppProviders>
        <div className="min-h-dvh bg-canvas text-fg">
          <Story />
        </div>
      </AppProviders>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <Page title="Buttons" description="Every action is an ActionButton with its shortcut shown.">
      <div className="flex flex-wrap gap-3">
        <ActionButton shortcut="nav.dashboard" variant="primary" onAction={() => {}}>
          Primary
        </ActionButton>
        <ActionButton shortcut="nav.dashboard" onAction={() => {}}>
          Secondary
        </ActionButton>
        <ActionButton shortcut="nav.dashboard" variant="ghost" onAction={() => {}}>
          Ghost
        </ActionButton>
        <ActionButton shortcut="nav.dashboard" variant="danger" onAction={() => {}}>
          Danger
        </ActionButton>
        <ActionButton shortcut="nav.dashboard" disabled onAction={() => {}}>
          Disabled
        </ActionButton>
      </div>
    </Page>
  ),
};

export const BadgesAndKeys: Story = {
  render: () => (
    <Page title="Badges and keys">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="accent">New</Badge>
        <Badge>Neutral</Badge>
        <Badge tone="positive">Imported</Badge>
        <Badge tone="negative">Can’t read</Badge>
        <Kbd shortcut="nav.dashboard" />
        <Kbd shortcut="nav.dashboard" />
      </div>
    </Page>
  ),
};

export const Forms: Story = {
  render: () => (
    <Page title="Form controls">
      <Card className="flex max-w-md flex-col gap-3 p-4">
        <TextInput placeholder="Text field" aria-label="Text field" />
        <TextInput defaultValue="2026-09-30" type="date" aria-label="Date" />
        <TextInput defaultValue="not a number" aria-invalid aria-label="Invalid field" />
        <Select aria-label="Select" defaultValue="b">
          <option value="a">Current account</option>
          <option value="b">Savings</option>
        </Select>
      </Card>
    </Page>
  ),
};

export const PageWithActions: Story = {
  render: () => (
    <Page
      title="Page title"
      description="A short line under the title."
      actions={
        <ActionButton shortcut="nav.dashboard" variant="primary" onAction={() => {}}>
          Add
        </ActionButton>
      }
    >
      <Card className="p-4 text-sm">Page content sits in cards.</Card>
    </Page>
  ),
};
