import type { Meta, StoryObj } from '@storybook/react';

import { DocumentListCard } from './document-list-card';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: DocumentListCard,
  title: 'Epics/Governance/DocumentListCard',
} satisfies Meta<typeof DocumentListCard>;

export default meta;

type Story = StoryObj<typeof DocumentListCard>;

export const Default: Story = {
  args: {
    creator: {
      name: 'Name',
      surname: 'Surname',
      avatarUrl: 'https://github.com/shadcn.png',
    },
    isLoading: false,
    title: 'Title',
    state: 'agreement',
    badges: [
      {
        value: 'agreement',
        className: 'capitalize',
        variant: 'solid',
        colorVariant: 'accent',
      },
      {
        value: '50%',
        variant: 'outline',
        colorVariant: 'accent',
      },
    ],
    comments: 100,
    views: 50,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Title/gi)).toBeTruthy();
  },
};
