import type { Meta, StoryObj } from '@storybook/react';

import { AddAttachment } from './add-attachment';
import { within } from '@storybook/test';
import { expect } from '@storybook/jest';

const meta = {
  component: AddAttachment,
  title: 'UI/Uploads/AddAttachment',
} satisfies Meta<typeof AddAttachment>;

export default meta;

type Story = StoryObj<typeof AddAttachment>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Add Attachment/gi)).toBeTruthy();
  },
};
