import type { Meta, StoryObj } from '@storybook/react';
import { MemberCard } from './member-card';

const meta: Meta<typeof MemberCard> = {
  component: MemberCard,
  title: 'Epics/People/MemberCard',
};
export default meta;
type Story = StoryObj<typeof MemberCard>;

export const Primary: Story = {
  args: {
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
    name: 'Name',
    surname: 'Surname',
    nickname: 'username',
    status: 'applicant',
    location: 'Paris, France',
    isLoading: false,
  },
};
