import type { Meta, StoryObj } from '@storybook/react';
import { CommentsList } from './comments-list';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof CommentsList> = {
  component: CommentsList,
  title: 'Epics/Interactions/CommentsList',
  argTypes: {
    setActiveFilter: { action: 'setActiveFilter executed!' },
  },
};
export default meta;
type Story = StoryObj<typeof CommentsList>;

export const Primary: Story = {
  args: {
    activeFilter: 'most-recent',
    pagination: {
      total: 1,
    },
    sortOptions: [
      {
        label: 'Most Recent',
        value: 'most-recent',
      },
      {
        label: 'Oldest',
        value: 'oldest',
      },
    ],
    comments: [
      {
        id: '1',
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
        author: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        likes: 10,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Comments \| 1/gi)).toBeTruthy();
  },
};
