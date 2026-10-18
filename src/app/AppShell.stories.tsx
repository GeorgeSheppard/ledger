import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Connected } from '../storybook/providers';
import { paths } from './paths';

const meta = { title: 'Pages/App shell' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const page = <div className="h-[200vh] p-6">A page taller than the screen.</div>;

/** The sidebar fills the window and stays put while the page scrolls. */
export const Sidebar: Story = {
  render: () => (
    <Connected shell route={paths.accounts}>
      {page}
    </Connected>
  ),
};

/** Exit with nothing unsaved leaves at once; with edits it asks first. `creditCard` leaves an unsaved edit. */
export const ExitUnsaved: Story = {
  render: () => (
    <Connected shell creditCard route={paths.accounts}>
      {page}
    </Connected>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /^exit/i }));
  },
};

/** "Exit without saving" asks once more before discarding anything. */
export const ExitAreYouSure: Story = {
  ...ExitUnsaved,
  play: async (context) => {
    await ExitUnsaved.play?.(context);
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('button', { name: /exit without saving/i })
    );
  },
};
