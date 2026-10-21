import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Connected } from '../storybook/providers';
import { expectOnTop } from '../storybook/floating';
import { CategoryPicker } from '../features/categories/CategoryPicker';
import { Menu } from './Menu';
import { FunnelIcon, Popover } from './Popover';
import { Dialog } from './Dialog';

const meta = { title: 'UI/Floating panels' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const CATEGORIES = [
  { name: 'Groceries', color: '#16a34a' },
  { name: 'Rent', color: '#2563eb' },
  { name: 'Eating out', color: '#d97706' },
];

/** Rows that would paint over a naive dropdown: a transform, `overflow: hidden`, later siblings. */
function HostileRows({ children }: { children?: (row: number) => React.ReactNode }) {
  return (
    <div className="h-72 w-full max-w-md overflow-hidden rounded-lg border border-line">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div
          key={row}
          className="relative flex h-12 translate-x-0 items-center justify-between border-b border-line bg-surface px-3 text-sm"
          style={{ transform: 'translateY(0)' }}
        >
          <span>Row {row} — text that must never show through a panel</span>
          {children?.(row)}
        </div>
      ))}
    </div>
  );
}

function PickerHost() {
  const [value, setValue] = useState('');
  return (
    <div className="w-40">
      <CategoryPicker
        value={value}
        categories={CATEGORIES}
        onChange={setValue}
        onCreate={async () => {}}
      />
    </div>
  );
}

function PopoverHost() {
  const [open, setOpen] = useState(false);
  return (
    <Popover label="Filter" open={open} onOpenChange={setOpen} panel={<p>Filter controls</p>}>
      <FunnelIcon />
    </Popover>
  );
}

/**
 * Every panel opened from inside clipping, transformed rows. Each is checked against what the
 * browser paints, so a panel that goes behind the rows or is cut off fails the story.
 */
export const InsideClippedRows: Story = {
  render: () => (
    <Connected>
      <div className="p-6">
        <HostileRows>
          {(row) =>
            row === 1 ? (
              <Menu label="Row menu" items={[{ label: 'Duplicate', onSelect() {} }]} />
            ) : row === 2 ? (
              <PopoverHost />
            ) : row === 3 ? (
              <PickerHost />
            ) : null
          }
        </HostileRows>
      </div>
    </Connected>
  ),
  play: async () => {
    const screen = within(document.body);
    await userEvent.click(await screen.findByRole('button', { name: 'Row menu' }));
    await expectOnTop(await screen.findByRole('menu'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await expectOnTop(await screen.findByRole('dialog', { name: 'Filter' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await expectOnTop(await screen.findByRole('listbox'));
  },
};

/** Close to the bottom edge there is no room below, so the panel flips above the button. */
export const FlipsAtTheBottom: Story = {
  render: () => (
    <Connected>
      <div className="flex min-h-dvh items-end justify-end p-6">
        <Menu
          label="Row menu"
          items={[
            { label: 'Duplicate', onSelect() {} },
            { label: 'Show only this category', onSelect() {} },
            { label: 'Delete', onSelect() {}, danger: true, separated: true },
          ]}
        />
      </div>
    </Connected>
  ),
  play: async () => {
    const screen = within(document.body);
    const button = await screen.findByRole('button', { name: 'Row menu' });
    await userEvent.click(button);
    const menu = await screen.findByRole('menu');
    await expectOnTop(menu.closest<HTMLElement>('[data-floating]')!);
    await expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      button.getBoundingClientRect().top
    );
  },
};

/** In a modal dialog (the browser's top layer) a panel has to live inside the dialog to be seen. */
export const InsideDialog: Story = {
  render: () => (
    <Connected>
      <Dialog title="A dialog" onClose={() => {}}>
        <div className="w-72">
          <PickerHost />
        </div>
      </Dialog>
    </Connected>
  ),
  play: async () => {
    const screen = within(document.body);
    await userEvent.click(await screen.findByRole('combobox', { name: 'Category' }));
    await expectOnTop(await screen.findByRole('listbox'));
  },
};
