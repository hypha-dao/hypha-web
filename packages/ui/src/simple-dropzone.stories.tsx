import type { Meta, StoryObj } from '@storybook/react';

import { SimpleDropzone } from './simple-dropzone';

const meta = {
  component: SimpleDropzone,
} satisfies Meta<typeof SimpleDropzone>;

export default meta;

type Story = StoryObj<typeof SimpleDropzone>;

export const Default: Story = {};
