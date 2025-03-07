import type { Meta, StoryObj } from '@storybook/react';

import { EditPersonHead } from './edit-person-head';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: EditPersonHead,
  title: 'Epics/People/EditPersonHead',
} satisfies Meta<typeof EditPersonHead>;

export default meta;

type Story = StoryObj<typeof EditPersonHead>;

export const Default: Story = {
  args: {
    avatar: 'https://github.com/shadcn.png',
    name: 'Name',
    surname: 'Surname',
    nickname: 'namesurname',
    isLoading: false,
    onNameChange: () => {},
    onSurnameChange: () => {},
    onNicknameChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Name Surname/gi)).toBeTruthy();
  },
};
