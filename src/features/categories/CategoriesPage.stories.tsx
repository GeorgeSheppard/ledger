import type { Meta, StoryObj } from '@storybook/react-vite';
import { Connected } from '../../storybook/providers';
import { CategoriesPage } from './CategoriesPage';

const meta = { title: 'Pages/Categories', component: CategoriesPage } satisfies Meta<
  typeof CategoriesPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Savings is excluded from calculations, so it carries the "Excluded" badge. */
export const Default: Story = {
  render: () => (
    <Connected shell route="/categories">
      <CategoriesPage />
    </Connected>
  ),
};
