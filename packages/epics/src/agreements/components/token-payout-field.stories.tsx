import type { Meta, StoryObj } from '@storybook/react';

import { TokenPayoutField } from './token-payout-field';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: TokenPayoutField,
  title: 'Epics/Agreements/TokenPayoutField',
} satisfies Meta<typeof TokenPayoutField>;

export default meta;

type Story = StoryObj<typeof TokenPayoutField>;

export const Default: Story = {
  args: {
    tokens: [
      {
        icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/refs/heads/master/svg/icon/btc.svg',
        symbol: 'BTC',
        name: 'Bitcoin',
      },
      {
        icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/refs/heads/master/svg/icon/eth.svg',
        symbol: 'ETH',
        name: 'Ethereum',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Payment Request/gi)).toBeTruthy();
  },
};
