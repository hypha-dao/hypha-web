import type { Meta, StoryObj } from '@storybook/react';

import { CreateAgreementForm } from './create-agreement-form';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: CreateAgreementForm,
  title: 'Epics/Agreements/CreateAgreementForm',
} satisfies Meta<typeof CreateAgreementForm>;

export default meta;

type Story = StoryObj<typeof CreateAgreementForm>;

export const Default: Story = {
  args: {
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'Name',
      surname: 'Surname',
    },
    isLoading: false,
    onCreate: () => {
      console.log('Publish proposal');
    },
    closeUrl: '/',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Name Surname/gi)).toBeTruthy();
  },
};
