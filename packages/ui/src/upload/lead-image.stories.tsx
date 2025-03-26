import type { Meta, StoryObj } from '@storybook/react';

import { UploadLeadImage } from './lead-image';

const meta = {
  component: UploadLeadImage,
  title: 'UI/Uploads/LeadImage',
} satisfies Meta<typeof UploadLeadImage>;

export default meta;

type Story = StoryObj<typeof UploadLeadImage>;

export const Default: Story = {
  args: {
    defaultImage: 'https://github.com/shadcn.png',
  },
};
