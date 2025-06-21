import type { Meta, StoryObj } from '@storybook/react';
import { MemberWithNumberFieldFieldArray } from './member-with-number-field-array';
import { Form } from '@hypha-platform/ui';
import { useForm } from 'react-hook-form';
import { ReactNode } from 'react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const FormDecorator = ({ children }: { children: ReactNode }) => {
  const methods = useForm({
    defaultValues: {
      members: [],
    },
  });

  return <Form {...methods}>{children}</Form>;
};

const meta = {
  component: MemberWithNumberFieldFieldArray,
  title: 'Epics/Agreements/MemberWithNumberFieldFieldArray',
  decorators: [
    (Story) => (
      <FormDecorator>
        <Story />
      </FormDecorator>
    ),
  ],
} satisfies Meta<typeof MemberWithNumberFieldFieldArray>;

export default meta;

type Story = StoryObj<typeof MemberWithNumberFieldFieldArray>;

export const Default: Story = {
  args: {
    members: [
      {
        id: 1,
        name: 'Charlie',
        surname: 'Chaplin',
        avatarUrl: 'https://github.com/shadcn.png',
        address: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd1',
      },
      {
        id: 2,
        name: 'Diana',
        surname: 'Doe',
        avatarUrl: 'https://github.com/shadcn.png',
        address: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd4',
      },
    ],
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Initial voice allocation/i)).toBeTruthy();
  },
};
