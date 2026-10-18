import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  // Not the app's public/: its _headers (CSP, X-Frame-Options: DENY) would block Storybook's own
  // scripts and preview iframe when deployed.
  viteFinal: (config) => ({ ...config, publicDir: false }),
};

export default config;
