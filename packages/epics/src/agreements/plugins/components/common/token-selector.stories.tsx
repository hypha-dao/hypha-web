import type { Meta, StoryObj } from '@storybook/react';

import { TokenSelector } from './token-selector';

const meta = {
  component: TokenSelector,
  title: 'Epics/Agreements/TokenSelector',
} satisfies Meta<typeof TokenSelector>;

export default meta;

type Story = StoryObj<typeof TokenSelector>;

export const Default: Story = {
  args: {
    tokens: [
      {
        icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/refs/heads/master/svg/icon/btc.svg',
        symbol: 'BTC',
        address: '0x23423i423j423j4kn23lknf2l3nfjk23nfkjkj23nfk',
      },
      {
        icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/refs/heads/master/svg/icon/eth.svg',
        symbol: 'ETH',
        address: '0x23423i423j423j4kn23lknf2l3nfjk23nfkjkj23nf2',
      },
    ],
  },
};
