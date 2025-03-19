import type { Meta, StoryObj } from '@storybook/react';
import { AvatarUploader } from './avatar-uploader';

const meta = {
  component: AvatarUploader,
  title: 'UI/Profile/AvatarUploader',
  args: {
    isUploading: false,
    uploadedAvatar: null,
    onReset: () => console.log('Reset clicked'),
    onUpload: (files: File[]) => console.log('Files uploaded:', files),
    size: 'md'
  }
} satisfies Meta<typeof AvatarUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAvatar: Story = {
  args: {
    uploadedAvatar: 'https://github.com/shadcn.png',
  },
};

export const Uploading: Story = {
  args: {
    isUploading: true,
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    uploadedAvatar: 'https://github.com/shadcn.png',
  },
};
