import type { Meta, StoryObj } from '@storybook/react';
import { MemberDetail } from './member-detail';

const meta: Meta<typeof MemberDetail> = {
  component: MemberDetail,
  title: 'Epics/People/MemberDetail',
};
export default meta;
type Story = StoryObj<typeof MemberDetail>;

export const Primary: Story = {
  args: {
    member: {
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
      name: 'Name',
      surname: 'Surname',
      nickname: 'username',
      status: 'applicant',
      about:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat',
    },
    isLoading: false,
    closeUrl: '',
    basePath: '',
    spaces: [
      {
        logo: 'https://github.com/shadcn.png',
        title: 'Legal & Regulatory',
        description:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt...',
        members: [
          {
            avatar:
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
            name: 'Name',
            surname: 'Surname',
          },
        ],
        projects: 3,
      },
    ],
    useDocuments: () => ({
      documents: [],
      isLoading: false,
    }),
  },
};
