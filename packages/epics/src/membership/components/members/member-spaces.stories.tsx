import type { Meta, StoryObj } from '@storybook/react';
import { MemberSpaces } from './member-spaces';

const meta: Meta<typeof MemberSpaces> = {
  component: MemberSpaces,
  title: 'Epics/Membership/MemberSpaces',
};
export default meta;
type Story = StoryObj<typeof MemberSpaces>;

export const Primary: Story = {
  args: {
    spaces: [
      {
        logoUrl: 'https://github.com/shadcn.png',
        title: 'Hypha Energy Hub',
        description:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt...',
        id: 0,
        leadImage: 'https://github.com/shadcn.png',
        slug: '',
      },
    ],
    isLoading: false,
  },
};
