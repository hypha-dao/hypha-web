import type { Meta, StoryObj } from '@storybook/react';

import { DocumentListCard } from './document-list-card';
import { DocumentStats } from './document-stats';
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
    interactions: <DocumentStats isLoading={false} views={50} comments={50} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Title/gi)).toBeTruthy();
  },
};
