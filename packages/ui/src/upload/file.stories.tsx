import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { FileUploader } from './file';

const meta = {
  component: FileUploader,
  title: 'UI/FileUploader',
} satisfies Meta<typeof FileUploader>;

export default meta;

type Story = StoryObj<typeof FileUploader>;

export const Default: Story = {
  args: {
    onValueChange: fn(),
  },
};
