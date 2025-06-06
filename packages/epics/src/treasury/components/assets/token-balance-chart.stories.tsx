import type { Meta, StoryObj } from '@storybook/react';
import { TokenBalanceChart } from './token-balance-chart';

const meta: Meta<typeof TokenBalanceChart> = {
  component: TokenBalanceChart,
  title: 'Epics/Treasury/TokenBalanceChart',
};
export default meta;
type Story = StoryObj<typeof TokenBalanceChart>;

export const Primary: Story = {
  args: {
    data: [
      { month: 'January', value: 186000, date: '2024-01-15' },
      { month: 'February', value: 305000, date: '2024-02-10' },
      { month: 'March', value: 237000, date: '2024-03-05' },
      { month: 'April', value: 73000, date: '2024-08-01' },
      { month: 'May', value: 209000, date: '2024-09-12' },
      { month: 'June', value: 214000, date: '2024-10-10' },
    ],
  },
};
