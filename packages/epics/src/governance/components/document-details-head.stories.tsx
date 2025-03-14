import type { Meta, StoryObj } from '@storybook/react';

import { DocumentDetailsHead } from './document-details-head';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: DocumentDetailsHead,
  title: 'Epics/Governance/DocumentDetailsHead',
} satisfies Meta<typeof DocumentDetailsHead>;

export default meta;

type Story = StoryObj<typeof DocumentDetailsHead>;

export const Default: Story = {
  args: {
    creator: {
      name: 'Name',
      surname: 'Surname',
      avatarUrl: 'https://github.com/shadcn.png',
    },
    isLoading: false,
    title: 'Title',
    badges: [
      {
        label: 'agreement',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      },
      {
        label: '50%',
        variant: 'outline',
        colorVariant: 'accent',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Title/gi)).toBeTruthy();
  },
};
