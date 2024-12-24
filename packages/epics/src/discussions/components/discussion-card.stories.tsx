import type { Meta, StoryObj } from '@storybook/react';
import { DiscussionCard } from './discussion-card';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof DiscussionCard> = {
  component: DiscussionCard,
  title: 'Epics/Discussions/DiscussionCard',
};
export default meta;
type Story = StoryObj<typeof DiscussionCard>;

export const Primary: Story = {
  args: {
    image: 'https://github.com/shadcn.png',
    title: 'Discussion Title',
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'Jane',
      surname: 'Doe',
    },
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
    views: 30,
    comments: 15,
    isLoading: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Discussion Title/gi)).toBeTruthy();
  },
};
