import type { Meta, StoryObj } from '@storybook/react';
import { Logo } from './index';

import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof Logo> = {
  component: Logo,
  title: 'UI/atoms/Logo',
};
export default meta;
type Story = StoryObj<typeof Logo>;

export const Primary: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify that the component renders without throwing errors
    expect(canvasElement).toBeTruthy();
    // Verify that the logo element exists in the DOM
    expect(canvas.getByRole('img', { name: /logo/i })).toBeInTheDocument();
  },
};
