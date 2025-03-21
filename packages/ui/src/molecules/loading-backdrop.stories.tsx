import type { Meta, StoryObj } from '@storybook/react';

import { LoadingBackdrop } from './loading-backdrop';

const meta = {
  component: LoadingBackdrop,
  title: 'UI/Molecules/LoadingBackdrop',
} satisfies Meta<typeof LoadingBackdrop>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLoading: false,
    progress: 39,
    message: 'loading data...',
    children: (
      <div className="max-w-md">
        <div>
          mollit voluptate cupidatat sint non sit duis quis aliqua non excepteur
          ipsum non et et do qui non veniam enim commodo incididunt eu aliquip
          mollit aliquip consectetur sint enim reprehenderit
        </div>
        <div>
          mollit voluptate cupidatat sint non sit duis quis aliqua non excepteur
          ipsum non et et do qui non veniam enim commodo incididunt eu aliquip
          mollit aliquip consectetur sint enim reprehenderit
        </div>
        <div>
          mollit voluptate cupidatat sint non sit duis quis aliqua non excepteur
          ipsum non et et do qui non veniam enim commodo incididunt eu aliquip
          mollit aliquip consectetur sint enim reprehenderit
        </div>
      </div>
    ),
  },
};
