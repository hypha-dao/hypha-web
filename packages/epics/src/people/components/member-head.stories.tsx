import type { Meta, StoryObj } from '@storybook/react';
import { MemberHead } from './member-head';

const meta: Meta<typeof MemberHead> = {
  component: MemberHead,
  title: 'Epics/People/MemberHead',
};
export default meta;
type Story = StoryObj<typeof MemberHead>;

export const Primary: Story = {
  args: {
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
    name: 'Name',
    surname: 'Surname',
    nickname: 'username',
    status: 'applicant',
    isLoading: false,
  },
};
