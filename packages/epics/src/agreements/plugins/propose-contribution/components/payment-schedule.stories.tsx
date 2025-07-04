import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

import { PaymentSchedule } from './payment-schedule';
import { Form } from '@hypha-platform/ui';
import { useForm } from 'react-hook-form';
import { ReactNode } from 'react';

const FormDecorator = ({ children }: { children: ReactNode }) => {
  const methods = useForm();
  return <Form {...methods}>{children}</Form>;
};

const meta = {
  component: PaymentSchedule,
  title: 'Epics/Agreements/PaymentSchedule',
  decorators: [
    (Story) => (
      <FormDecorator>
        <Story />
      </FormDecorator>
    ),
  ],
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
