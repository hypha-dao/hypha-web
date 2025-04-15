import type { Meta, StoryObj } from '@storybook/react';

import { Calendar } from './calendar';

const meta = {
  component: Calendar,
  title: 'UI/Calendar',
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof Calendar>;

export const Default: Story = {};
