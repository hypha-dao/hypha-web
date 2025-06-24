import type { Meta, StoryObj } from '@storybook/react';

import { InnerSpacesList } from './inner-spaces-list';

const meta = {
  component: InnerSpacesList,
  title: 'Epics/Spaces/InnerSpacesList',
} satisfies Meta<typeof InnerSpacesList>;

export default meta;

type Story = StoryObj<typeof InnerSpacesList>;

export const Default: Story = {
  args: {},
};
