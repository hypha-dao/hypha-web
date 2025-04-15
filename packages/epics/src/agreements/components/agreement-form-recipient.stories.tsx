import type { Meta, StoryObj } from '@storybook/react';

import { AgreementFormRecipient } from './agreement-form-recipient';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta = {
  component: AgreementFormRecipient,
  title: 'Epics/Agreements/AgreementFormRecipient',
} satisfies Meta<typeof AgreementFormRecipient>;

export default meta;

type Story = StoryObj<typeof AgreementFormRecipient>;

export const Default: Story = {
  args: {
    members: [
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Alice',
        surname: 'Johnson',
        id: 1,
      },
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Bob',
        surname: 'Smith',
        id: 2,
      },
      {
        avatarUrl: 'https://github.com/shadcn.png',
        name: 'Charlie',
        surname: 'Brown',
        id: 3,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/ Recipient/gi)).toBeTruthy();
  },
};
