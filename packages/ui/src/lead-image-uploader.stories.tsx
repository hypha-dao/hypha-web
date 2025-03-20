import type { Meta, StoryObj } from '@storybook/react';

import { LeadImageUploader } from './lead-image-uploader';

const meta = {
  component: LeadImageUploader,
  title: 'UI/LeadImageUploader',
} satisfies Meta<typeof LeadImageUploader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
