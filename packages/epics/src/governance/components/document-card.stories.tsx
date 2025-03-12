import type { Meta, StoryObj } from '@storybook/react';

import { DocumentCard } from './document-card';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: DocumentCard,
  title: 'Epics/Governance/DocumentCard',
} satisfies Meta<typeof DocumentCard>;

export default meta;

type Story = StoryObj<typeof DocumentCard>;

export const Default: Story = {
  args: {
    creator: {
      name: 'Name',
      surname: 'Surname',
      avatarUrl: 'https://github.com/shadcn.png',
    },
    isLoading: false,
    leadImage: 'https://github.com/shadcn.png',
    title: 'Title',
    description: 'Description',
    state: 'agreement',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Title/gi)).toBeTruthy();
  },
};
