import type { Meta, StoryObj } from '@storybook/react';

import { DecaySettings } from './decay-settings';

const meta = {
  component: DecaySettings,
  title: 'Epics/Agreements/DecaySettings',
} satisfies Meta<typeof DecaySettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
