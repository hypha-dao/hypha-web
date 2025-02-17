import type { Meta, StoryObj } from '@storybook/react';
import { FormInput } from './form-input';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof FormInput> = {
  component: FormInput,
  title: 'Epics/Interactions/FormInput',
};
export default meta;
type Story = StoryObj<typeof FormInput>;

export const Primary: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByPlaceholderText(/Type a comment here/i),
    ).toBeInTheDocument();
  },
};
