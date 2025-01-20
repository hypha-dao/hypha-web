import type { Meta, StoryObj } from '@storybook/react';
import { IPFSImage } from './ipfs-image';
import { IPFSProvider } from '@hypha-platform/ipfs';

const meta: Meta<typeof IPFSImage> = {
  component: IPFSImage,
  title: 'Epics/Assets/IPFSImage',
  decorators: [
    (Story) => (
      <IPFSProvider>
        <Story />
      </IPFSProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof IPFSImage>;

export const Primary: Story = {
  args: {
    cid: 'Qmf5r8wKfCSXps1477uk4Y77upcui31btsuZ4dHLfqN6Jj',
    alt: 'Image',
  },
};
