import type { Meta, StoryObj } from '@storybook/react';

import { TokenPayoutField } from './token-payout-field';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { ReactNode, useState } from 'react';
import type { Token } from './token-payout-field';
import { useForm } from 'react-hook-form';
import { Form } from '@hypha-platform/ui';

const FormDecorator = ({ children }: { children: ReactNode }) => {
  const methods = useForm();
  return <Form {...methods}>{children}</Form>;
};

const meta = {
  component: TokenPayoutField,
  title: 'Epics/Agreements/TokenPayoutField',
  decorators: [
    (Story) => (
      <FormDecorator>
        <Story />
      </FormDecorator>
    ),
  ],
} satisfies Meta<typeof TokenPayoutField>;

export default meta;

type Story = StoryObj<typeof TokenPayoutField>;

export const Default: Story = {
  args: {
    arrayFieldIndex: 0,
    arrayFieldName: 'payout',
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
