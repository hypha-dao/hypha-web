import type { Meta, StoryObj } from '@storybook/react';

import { AvatarUploader } from './avatar-uploader';

const meta = {
  component: AvatarUploader,
  title: 'UI/AvatarUploader',
} satisfies Meta<typeof AvatarUploader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    uploadedFile: '',
    previewUrl: '',
    size: 'sm',
    isUploading: false,
    isDragActive: false,
  },
};
