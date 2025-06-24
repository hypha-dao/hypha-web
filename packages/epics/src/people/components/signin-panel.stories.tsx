import type { Meta, StoryObj } from '@storybook/react';

import SigninPanel from './signin-panel';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: SigninPanel,
  title: 'Epics/People/SigninPanel',
} satisfies Meta<typeof SigninPanel>;

export default meta;

type Story = StoryObj<typeof SigninPanel>;

export const Default: Story = {
  args: {
    closeUrl: '',
    signinUrl: '',
    signupUrl: '',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Create a new Hypha Network Account/gi),
    ).toBeTruthy();
  },
};
