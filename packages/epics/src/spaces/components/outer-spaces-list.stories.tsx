import type { Meta, StoryObj } from '@storybook/react';

import { OuterSpacesList } from './outer-spaces-list';

const meta = {
  component: OuterSpacesList,
  title: 'Epics/Spaces/OuterSpacesList',
} satisfies Meta<typeof OuterSpacesList>;

export default meta;

type Story = StoryObj<typeof OuterSpacesList>;

export const Default: Story = {
  args: {},
};
