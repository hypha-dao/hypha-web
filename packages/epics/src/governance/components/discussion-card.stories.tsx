import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

import { DiscussionCard } from './discussion-card';

const DESCRIPTION = `
# Headline 1

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

## Headline 2

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

### Headline 3

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris
`;

const meta = {
  component: DiscussionCard,
  title: 'Epics/Governance/DiscussionCard',
} satisfies Meta<typeof DiscussionCard>;

export default meta;

type Story = StoryObj<typeof DiscussionCard>;

export const Default: Story = {
  args: {
    leadImageUrl: '',
    space: {
      title: 'Hypha Space',
      logoUrl: '',
    },
    creator: {
      name: 'John',
      surname: 'Doe',
    },
    publicationDate: new Date('2025-01-01:12:00:00'),
    description: DESCRIPTION,
    isLoading: false,
    replies: 10,
    likes: 20,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Hypha Space/gi)).toBeTruthy();
  },
};
