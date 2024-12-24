import type { Meta, StoryObj } from '@storybook/react';

import { DiscussionChat } from './discussion-chat';

const meta: Meta<typeof DiscussionChat> = {
  component: DiscussionChat,
  title: 'Epics/Discussions/DiscussionChat',
};
export default meta;
type Story = StoryObj<typeof DiscussionChat>;

export const Primary: Story = {
  args: {
    messages: [
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
    ],
    isLoading: false,
  },
};
