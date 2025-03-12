import type { Meta, StoryObj } from '@storybook/react';

import { ViewsAndComments } from './views-and-comments';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: ViewsAndComments,
  title: 'Epics/Common/ViewsAndComments',
} satisfies Meta<typeof ViewsAndComments>;

export default meta;

type Story = StoryObj<typeof ViewsAndComments>;

export const Default: Story = {
  args: {
    views: 100,
    comments: 100,
    isLoading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/100!/gi)).toBeTruthy();
  },
};
