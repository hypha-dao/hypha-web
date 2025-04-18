import type { Meta, StoryObj } from '@storybook/react';

import { PaymentSchedule } from './payment-schedule';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: PaymentSchedule,
  title: 'Epics/Agreements/PaymentSchedule',
} satisfies Meta<typeof PaymentSchedule>;

export default meta;

type Story = StoryObj<typeof PaymentSchedule>;

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Payment Schedule/gi)).toBeTruthy();
  },
};
