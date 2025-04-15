import type { Meta, StoryObj } from '@storybook/react';

import { AgreementFormWalletAddress } from './agreement-form-wallet-address';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: AgreementFormWalletAddress,
  title: 'Epics/Agreements/AgreementFormWalletAddress',
} satisfies Meta<typeof AgreementFormWalletAddress>;

export default meta;

type Story = StoryObj<typeof AgreementFormWalletAddress>;

export const Default: Story = {
  args: {
    address: 'opndsox0c8vbi91H092u7nz0A02so',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Wallet Address/gi)).toBeTruthy();
  },
};
