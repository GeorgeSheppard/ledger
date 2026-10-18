import type { Meta, StoryObj } from '@storybook/react-vite';
import { Connected } from '../../storybook/providers';
import { PaychecksPage } from './PaychecksPage';

const meta = { title: 'Pages/Paychecks', component: PaychecksPage } satisfies Meta<
  typeof PaychecksPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Connected shell route="/paychecks">
      <PaychecksPage />
    </Connected>
  ),
};
