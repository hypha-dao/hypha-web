import type { Meta, StoryObj } from '@storybook/react';

import { DocumentCard } from './document-card';
import { DocumentStats } from './document-stats';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: DocumentCard,
  title: 'Epics/Governance/DocumentCard',
} satisfies Meta<typeof DocumentCard>;

const DESCRIPTION = `
# Headline 1

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

## Headline 2

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

### Headline 3

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris
`;

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
    description: DESCRIPTION,
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
