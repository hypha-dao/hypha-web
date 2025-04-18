import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker } from './date-picker';

const meta = {
  component: DatePicker,
  title: 'UI/DatePicker',
  argTypes: {
    mode: {
      options: ['single', 'range'],
      control: { type: 'radio' },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: {
    mode: 'single',
  },
};

export const Range: Story = {
  args: {
    mode: 'range',
  },
};
