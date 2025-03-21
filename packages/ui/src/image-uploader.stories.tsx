import type { Meta, StoryObj } from '@storybook/react';
import { ImageUploader } from './image-uploader';
import { AvatarUploader } from './avatar-uploader';
import { LeadImageUploader } from './lead-image-uploader';

const meta = {
  component: ImageUploader,
  title: 'UI/ImageUploader',
  args: {
    isUploading: false,
    uploadedFile: null,
  },
} satisfies Meta<typeof ImageUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAvatar: Story = {
  args: {
    isUploading: false,
    uploadedFile: null,
  },
  render: (args) => (
    <ImageUploader {...args}>
      <AvatarUploader size="md" />
    </ImageUploader>
  ),
};

export const WithLeadImage: Story = {
  args: {
    isUploading: false,
    uploadedFile: null,
  },
  render: (args) => (
    <ImageUploader {...args}>
      <LeadImageUploader />
    </ImageUploader>
  ),
};
