import type { Meta, StoryObj } from '@storybook/react';

import { ImageUploader } from './image-uploader';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: ImageUploader,
  title: 'UI/Profile/ImageUploader',
} satisfies Meta<typeof ImageUploader>;

export default meta;

type Story = StoryObj<typeof ImageUploader>;

export const Default: Story = {
  args: {
    isUploading: false,
    uploadedFile: '',
    onReset: () => {
      console.log('Reset handler');
    },
    onUpload: () => {
      console.log('Upload handler');
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Upload/gi)).toBeTruthy();
  },
};
