import type { Preview } from '@storybook/nextjs';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { withAppProviders } from './decorators';
import '../src/app/globals.css';

const preview: Preview = {
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
    controls: {
      expanded: true,
    },
    layout: 'centered',
  },
};

export default preview;
