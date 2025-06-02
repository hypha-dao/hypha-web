import type { Meta, StoryObj } from '@storybook/react';

import { SpaceForm } from './create-space-form';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: SpaceForm,
  title: 'Epics/Spaces/CreateSpaceForm',
} satisfies Meta<typeof SpaceForm>;

export default meta;

type Story = StoryObj<typeof SpaceForm>;

export const Default: Story = {
  args: {
    isLoading: false,
    closeUrl: '',
    creator: {
      name: 'John',
      surname: 'Doe',
    },
    defaultValues: {
      title: 'John Doe',
      description: 'This is a description',
      categories: ['housing'],
      leadImage: 'https://github.com/shadcn.png',
      links: ['https://www.google.com'],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/John Doe/gi)).toBeTruthy();
    expect(canvas.getByText(/This is a description/gi)).toBeTruthy();
    expect(canvas.getByText(/housing/gi)).toBeTruthy();
    expect(canvas.getByText(/https:\/\/www\.google\.com/gi)).toBeTruthy();
  },
};
