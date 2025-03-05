import type { Meta, StoryObj } from '@storybook/react';

import { EditPersonSection } from './edit-person-section';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: EditPersonSection,
  title: 'Epics/People/EditPersonSection',
} satisfies Meta<typeof EditPersonSection>;

export default meta;

type Story = StoryObj<typeof EditPersonSection>;

export const Default: Story = {
  args: {
    avatar: 'https://github.com/shadcn.png',
    name: 'Name',
    surname: 'Surname',
    id: 'ndb9suh3qh9q2hlP2120dsxzf',
    isLoading: false,
    closeUrl: '',
    description: '',
    leadImageUrl: ''
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Name Surname/gi)).toBeTruthy();
  },
};
