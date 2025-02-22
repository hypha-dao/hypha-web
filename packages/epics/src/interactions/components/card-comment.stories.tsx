import type { Meta, StoryObj } from '@storybook/react';
import { CardComment } from './card-comment';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof CardComment> = {
  component: CardComment,
  title: 'Epics/Interactions/CardComment',
};
export default meta;
type Story = StoryObj<typeof CardComment>;

export const Primary: Story = {
  args: {
    comment:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    author: {
      avatar: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    likes: 10,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/John/gi)).toBeTruthy();
    expect(canvas.getByText(/Doe/gi)).toBeTruthy();
  },
};
