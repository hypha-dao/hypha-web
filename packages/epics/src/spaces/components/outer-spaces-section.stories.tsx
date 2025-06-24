import type { Meta, StoryObj } from '@storybook/react';

import { OuterSpacesSection } from './outer-spaces-section';

const meta = {
  component: OuterSpacesSection,
  title: 'Epics/Spaces/OuterSpacesSection',
} satisfies Meta<typeof OuterSpacesSection>;

export default meta;

type Story = StoryObj<typeof OuterSpacesSection>;

export const Default: Story = {
  args: {},
};
