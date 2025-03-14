import type { Meta, StoryObj } from '@storybook/react';

import { DiscussionHead } from './discussion-head';

const meta = {
  component: DiscussionHead,
  title: 'Epics/Discussions/DiscussionHead',
} satisfies Meta<typeof DiscussionHead>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    creator: {
      avatarUrl: 'https://github.com/shadcn.png',
      name: 'Name',
      surname: 'Surname',
    },
    title: 'Discussion Title',
    isLoading: false,
  },
};
