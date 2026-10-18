import type { Preview } from '@storybook/react-vite';
// The app's own stylesheet: Tailwind plus the colour tokens. Light and dark follow the browser's
// colour scheme, exactly as in the app.
import '../src/styles/global.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    options: { storySort: { order: ['UI', 'Pages', 'Dialogs'] } },
  },
};

export default preview;
