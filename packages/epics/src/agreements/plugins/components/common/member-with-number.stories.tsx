import type { Meta, StoryObj } from '@storybook/react';
import { MemberWithNumberField } from './member-with-number';
import { Form } from '@hypha-platform/ui';
import { useForm } from 'react-hook-form';
import { ReactNode } from 'react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const FormDecorator = ({ children }: { children: ReactNode }) => {
  const methods = useForm({
    defaultValues: {
      memberField: {
        member: '',
        number: '',
      },
    },
  });

  return <Form {...methods}>{children}</Form>;
};

const meta = {
  component: MemberWithNumberField,
  title: 'Epics/Agreements/MemberWithNumberField',
  decorators: [
    (Story) => (
      <FormDecorator>
        <Story />
      </FormDecorator>
    ),
  ],
} satisfies Meta<typeof MemberWithNumberField>;

export default meta;

type Story = StoryObj<typeof MemberWithNumberField>;

export const Default: Story = {
  args: {
    members: [
      {
        id: 1,
        name: 'Alice',
        surname: 'Anderson',
        avatarUrl: 'https://github.com/shadcn.png',
        address: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
      },
      {
        id: 2,
        name: 'Bob',
        surname: 'Brown',
        avatarUrl: 'https://github.com/shadcn.png',
        address: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd1',
      },
    ],
    value: {
      member: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
      number: 100,
    },
    onChange: () => {
      console.log('onChange handler');
    },
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText(/Select member.../i)).toBeTruthy();
  },
};
