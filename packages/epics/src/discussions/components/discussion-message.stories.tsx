import type { Meta, StoryObj } from '@storybook/react';

import { DiscussionMessage } from './discussion-message';

const meta = {
  component: DiscussionMessage,
  title: 'Epics/Discussions/DiscussionMessage',
} satisfies Meta<typeof DiscussionMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'Name',
      surname: 'Surname',
    },
    message:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    date: '2024/09/24',
    isLoading: false,
    replies: [],
    isReply: false,
  },
};
