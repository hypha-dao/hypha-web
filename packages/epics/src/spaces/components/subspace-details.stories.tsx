import type { Meta, StoryObj } from '@storybook/react';
import { SubspaceDetail } from './subspace-detail';

const meta: Meta<typeof SubspaceDetail> = {
  component: SubspaceDetail,
  title: 'Epics/Spaces/SubspaceDetail',
};
export default meta;
type Story = StoryObj<typeof SubspaceDetail>;

export const Primary: Story = {
  args: {
    title: 'Some Title',
    image: 'https://github.com/shadcn.png',
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat',
    useMembers: () => ({
      isLoading: false,
      members: [
        {
          id: 1,
          slug: 'member-1',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
        {
          id: 2,
          slug: 'member-2',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'active',
          location: 'Paris, France',
        },
        {
          id: 3,
          slug: 'member-3',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'inactive',
          location: 'Paris, France',
        },
        {
          id: 4,
          slug: 'member-4',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'rejected',
          location: 'Paris, France',
        },
        {
          id: 5,
          slug: 'member-5',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
        {
          id: 6,
          slug: 'member-6',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
        {
          id: 7,
          slug: 'member-7',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
        {
          id: 8,
          slug: 'member-8',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
        {
          id: 9,
          slug: 'member-9',
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
          name: 'Name',
          surname: 'Surname',
          nickname: 'username',
          status: 'applicant',
          location: 'Paris, France',
        },
      ],
    }),
  },
};
