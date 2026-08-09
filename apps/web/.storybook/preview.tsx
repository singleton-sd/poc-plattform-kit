import type { Preview } from '@storybook/nextjs';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { withAppProviders } from './decorators';
import '../src/app/globals.css';

initialize({
  onUnhandledRequest: 'error',
});

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [
    withAppProviders,
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    a11y: {
      test: 'error',
    },
    chromatic: {
      // One deliberate Chromium viewport keeps the initial snapshot budget small.
      viewports: [1280],
    },
    controls: {
      expanded: true,
    },
    layout: 'centered',
  },
};

export default preview;
