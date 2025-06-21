import type { Meta, StoryObj } from '@storybook/react';

import { TokenIcon } from './token-icon';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: TokenIcon,
  title: 'UI/Uploads/TokenIcon',
} satisfies Meta<typeof TokenIcon>;

export default meta;

type Story = StoryObj<typeof TokenIcon>;

export const Default: Story = {
  args: {
    isUploading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Upload/gi)).toBeTruthy();
  },
};
