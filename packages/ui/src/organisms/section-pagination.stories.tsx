import type { Meta, StoryObj } from '@storybook/react';

import { SectionPagination } from './section-pagination';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: SectionPagination,
  title: 'UI/SectionPagination'
} satisfies Meta<typeof SectionPagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    onPageChange: () => {
      console.log('Page changed')
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Next/gi)).toBeTruthy();
  },
};
