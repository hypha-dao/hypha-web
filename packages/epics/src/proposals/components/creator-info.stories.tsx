import type { Meta, StoryObj } from '@storybook/react';

import { CreatorInfo } from './creator-info';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: CreatorInfo,
  title: 'Epics/Proposals/CreatorInfo',
} satisfies Meta<typeof CreatorInfo>;

export default meta;

type Story = StoryObj<typeof CreatorInfo>;

export const Default: Story = {
  args: {
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    isLoading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/John Doe!/gi)).toBeTruthy();
  },
};
