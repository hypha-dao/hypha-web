import type { Meta, StoryObj } from '@storybook/react';

import { Message } from './message';

const meta = {
  component: Message,
  title: 'Epics/Interactions/Message',
} satisfies Meta<typeof Message>;

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
