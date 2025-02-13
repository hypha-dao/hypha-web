import type { Meta, StoryObj } from '@storybook/react';

import { ButtonProfile } from './button-profile';

const meta = {
  component: ButtonProfile,
  title: 'UI/Profile/ButtonProfile',
} satisfies Meta<typeof ButtonProfile>;

export default meta;

type Story = StoryObj<typeof ButtonProfile>;

export const Default: Story = {
  args: {
    avatarSrc: "https://github.com/shadcn.png",
    userName: 'Username',
    address: '0x76cf15F64229dF9EF26e1957d4846Ba73D8E7828',
    isConnected: true,
    login: () => { },
    logout: () => { },
    deleteProfile: () => { },
    transitionToProfile: () => { },
    transitionToEdit: () => { }
  }
};
