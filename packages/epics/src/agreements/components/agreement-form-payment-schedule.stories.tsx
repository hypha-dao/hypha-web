import type { Meta, StoryObj } from '@storybook/react';

import { AgreementFormPaymentSchedule } from './agreement-form-payment-schedule';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { fn } from '@storybook/test';

const meta = {
  component: AgreementFormPaymentSchedule,
  title: 'Epics/Agreements/AgreementFormPaymentSchedule',
} satisfies Meta<typeof AgreementFormPaymentSchedule>;

export default meta;

type Story = StoryObj<typeof AgreementFormPaymentSchedule>;

export const Default: Story = {
  args: {
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Payment Schedule/gi)).toBeTruthy();
  },
};
