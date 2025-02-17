import type { Meta, StoryObj } from '@storybook/react';
import { MembersList } from './members-list';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<typeof MembersList> = {
  component: MembersList,
  title: 'Epics/Membership/MembersList',
};
export default meta;
type Story = StoryObj<typeof MembersList>;

export const Primary: Story = {
  args: {
    useMembers: () => ({
      isLoading: false,
      members: [
        {
          id: 1,
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Jane',
          surname: 'Doe',
          nickname: 'username',
          location: 'Paris, France',
          slug: 'member-1',
        },
        {
          id: 2,
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Jon',
          surname: 'Doe',
          nickname: 'username',
          location: 'Paris, France',
          slug: 'member-2',
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.findByText((content) => content.includes('Jane')),
    ).resolves.toBeInTheDocument();

    expect(
      canvas.findByText((content) => content.includes('Jon')),
    ).resolves.toBeInTheDocument();
  },
};
