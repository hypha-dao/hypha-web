import type { Meta, StoryObj } from '@storybook/react';

import { Recipient } from './recipient';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: Recipient,
  title: 'Epics/Agreements/Recipient',
} satisfies Meta<typeof Recipient>;

export default meta;

type Story = StoryObj<typeof Recipient>;

export const Default: Story = {
  args: {
    recipients: [
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Alice',
        surname: 'Johnson',
        address: '0xc0ffee254729296a45a3885639AC7E10F9d54972',
      },
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Bob',
        surname: 'Smith',
        address: '0xc0ffee254729296a45a3885639AC7E10F9d54975',
      },
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Charlie',
        surname: 'Brown',
        address: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/ Recipient/gi)).toBeTruthy();
  },
};
