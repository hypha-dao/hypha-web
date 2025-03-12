import type { Meta, StoryObj } from '@storybook/react';

import { GridAgreementView } from './grid-agreement-view';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: GridAgreementView,
  title: 'Epics/Agreements/GridAgreementView',
} satisfies Meta<typeof GridAgreementView>;

export default meta;

type Story = StoryObj<typeof GridAgreementView>;

export const Default: Story = {
  args: {
    commitment: 50,
    status: 'active',
    title: 'Agreement 1',
    creator: {
      name: 'John',
      surname: 'Doe',
      avatar: 'https://github.com/shadcn.png',
    },
    isLoading: false,
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Agreement 1/gi)).toBeTruthy();
  },
};
