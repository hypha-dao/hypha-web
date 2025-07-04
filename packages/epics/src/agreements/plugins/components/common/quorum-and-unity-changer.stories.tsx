import type { Meta, StoryObj } from '@storybook/react';

import { QuorumAndUnityChanger } from './quorum-and-unity-changer';

const meta = {
  component: QuorumAndUnityChanger,
  title: 'Epics/Agreements/QuorumAndUnityChanger',
} satisfies Meta<typeof QuorumAndUnityChanger>;

export default meta;

type Story = StoryObj<typeof QuorumAndUnityChanger>;

export const Default: Story = {};
