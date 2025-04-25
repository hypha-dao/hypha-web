import type { Meta, StoryObj } from '@storybook/react';

import { WalletAddress } from './wallet-address';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: WalletAddress,
  title: 'Epics/Agreements/WalletAddress',
} satisfies Meta<typeof WalletAddress>;

export default meta;

type Story = StoryObj<typeof WalletAddress>;

export const Default: Story = {
  args: {
    address: 'opndsox0c8vbi91H092u7nz0A02so',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Wallet Address/gi)).toBeTruthy();
  },
};
