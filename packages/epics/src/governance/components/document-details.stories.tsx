import type { Meta, StoryObj } from '@storybook/react';
import { DocumentDetails } from './document-details';

const DESCRIPTION = `
# Headline 1

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

## Headline 2

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris

### Headline 3

nostrud cillum voluptate est incididunt pariatur deserunt amet aute aliqua pariatur exercitation excepteur sit excepteur esse commodo excepteur irure nostrud esse officia esse ad velit cupidatat voluptate esse ullamco laboris
`;

const meta: Meta<typeof DocumentDetails> = {
  component: DocumentDetails,
  title: 'Epics/Governance/DocumentDetails',
};
export default meta;
type Story = StoryObj<typeof DocumentDetails>;

export const Primary: Story = {
  args: {
    creator: {
      avatarUrl: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    closeUrl: '',
    title: 'Discussion Title',
    isLoading: false,
    description: DESCRIPTION,
    leadImage: 'https://github.com/shadcn.png',
    badges: [
      {
        label: 'discussion',
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
};
