import type { Meta, StoryObj } from '@storybook/react';

import { TransferCard } from './transfer-card';

const meta = {
  component: TransferCard,
  title: 'Epics/Treasury/TransferCard',
} satisfies Meta<typeof TransferCard>;

export default meta;

type Story = StoryObj<typeof TransferCard>;

export const Default: Story = {
  args: {
    name: 'John',
    surname: 'Doe',
    avatar: 'https://github.com/shadcn.png',
    value: 1000,
    symbol: 'ETH',
    date: '2024-01-01',
    isLoading: false,
  },
};
