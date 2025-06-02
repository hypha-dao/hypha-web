import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';
import { themes } from '@storybook/theming';
import '@hypha-platform/ui-utils/global.css';
import '@hypha-platform/ui/styles.css';

// THANK GOD FOR THIS FIX
// https://github.com/storybookjs/storybook/issues/23684#issuecomment-1682143610
import { unoptimizeNextImageForStorybook } from '@hypha-platform/ui';
unoptimizeNextImageForStorybook();

import { hyphaLight, hyphaDark } from './theme';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  viewport: {
    viewports: INITIAL_VIEWPORTS,
  },
  darkMode: {
    stylePreview: true,
    dark: { ...themes.dark, ...hyphaDark },
    light: { ...themes.light, ...hyphaLight },
  },
};
