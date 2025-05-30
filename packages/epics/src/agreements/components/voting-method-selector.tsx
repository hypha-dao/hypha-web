'use client';

import { Card } from '@hypha-platform/ui';
import { useState } from 'react';
import clsx from 'clsx';
import { PlusCircledIcon } from '@radix-ui/react-icons';

type VotingMethod = {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

const votingMethods: VotingMethod[] = [
  {
    id: '1m1v',
    title: '1 Member 1 Vote',
    description: 'Each member has an equal say, regardless of token holdings.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1v1v',
    title: '1 Voice 1 Vote',
    description: 'Votes are distributed based on membership or reputation.',
    icon: <PlusCircledIcon />,
  },
  {
    id: '1t1v',
    title: '1 Token 1 Vote',
    description: 'Voting power is proportional to the number of tokens held.',
    icon: <PlusCircledIcon />,
    disabled: true, // TODO: hide for MVP
  },
];

type VotingMethodSelectorProps = {
  onChange?: (value: string) => void;
};

export const VotingMethodSelector = ({
  onChange,
}: VotingMethodSelectorProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (id: string, disabled?: boolean) => {
    if (disabled) return;
    setSelected(id);
    if (onChange) {
      onChange(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {votingMethods.map((method) => (
        <Card
          key={method.id}
          className={clsx(
            'flex p-5 cursor-pointer space-x-4 items-center border-2',
            {
              'border-accent-9': selected === method.id,
              'opacity-50 cursor-not-allowed': method.disabled,
              'hover:border-accent-5': !method.disabled,
            },
          )}
          onClick={() => handleSelect(method.id, method.disabled)}
        >
          <div>{method.icon}</div>
          <div className="flex flex-col">
            <span className="text-3 font-medium">{method.title}</span>
            <span className="text-1 text-neutral-11">{method.description}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};
