import type { Meta, StoryObj } from '@storybook/react';
import { InnerSpaceCard } from './inner-space-card';

const meta: Meta<typeof InnerSpaceCard> = {
  component: InnerSpaceCard,
  title: 'Epics/Spaces/InnerSpaceCard',
};
export default meta;
type Story = StoryObj<typeof InnerSpaceCard>;

export const Primary: Story = {
  args: {
    leadImageUrl: 'https://github.com/shadcn.png',
    title: 'Legal & Regulatory',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt...',
    members: [
      {
        avatar: 'https://github.com/shadcn.png',
        name: 'Jane',
        surname: 'Doe',
      },
      {
        avatar: 'https://github.com/shadcn.png',
        name: 'Jane',
        surname: 'Doe',
      },
      {
        avatar: 'https://github.com/shadcn.png',
        name: 'Jane',
        surname: 'Doe',
      },
      {
        avatar: 'https://github.com/shadcn.png',
        name: 'Jane',
        surname: 'Doe',
      },
    ],
    isLoading: false,
  },
};
