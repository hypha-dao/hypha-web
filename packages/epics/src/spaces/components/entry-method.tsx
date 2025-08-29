'use client';

import {
  Card,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import clsx from 'clsx';
import { EntryMethodType } from '@hypha-platform/core/client';
import { PlusCircledIcon } from '@radix-ui/react-icons';

type EntryMethodProps = {
  value?: EntryMethodType;
  onChange?: (selected: EntryMethodType) => void;
};

type EntryMethodOption = {
  id: EntryMethodType;
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
};

const entryMethods: EntryMethodOption[] = [
  {
    id: EntryMethodType.OPEN_ACCESS,
    title: 'Open Access',
    disabled: false,
    icon: <PlusCircledIcon />,
    description:
      'New members can join instantly. Participation is open to everyone and fully transparent.',
  },
  {
    id: EntryMethodType.INVITE_ONLY,
    title: 'Invite Request',
    disabled: false,
    icon: <PlusCircledIcon />,
    description:
      'New members can participate by requesting an invitation to join. Existing members vote on invite requests. Participation is only open to invited members but remains fully transparent to everyone.',
  },
  {
    id: EntryMethodType.TOKEN_BASED,
    title: 'Token Based',
    disabled: false,
    icon: <PlusCircledIcon />,
    description:
      'New members can join if they meet token requirements. Participation is only open to eligible members but remains fully transparent to everyone.',
  },
];

export const EntryMethod = ({ onChange, value }: EntryMethodProps) => {
  const handleSelect = (selection: EntryMethodType, disabled?: boolean) => {
    if (disabled) return;
    if (onChange) {
      onChange(selection);
    }
  };

  const equalNumbers = (value1: any, value2: any, _default: any): boolean => {
    return Number(value1 ?? _default) === Number(value2 ?? _default);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full justify-between items-center gap-2">
        <div className="flex flex-col gap-4 w-full">
          <label className="text-sm text-neutral-11">Entry Method</label>
          {entryMethods.map((option) => (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <Card
                  className={clsx(
                    'flex p-5 cursor-pointer space-x-4 items-center border-2 w-full',
                    {
                      'border-accent-9': equalNumbers(
                        value,
                        option.id,
                        EntryMethodType.OPEN_ACCESS,
                      ),
                      'opacity-50 cursor-not-allowed': option.disabled,
                      'hover:border-accent-5': !option.disabled,
                    },
                  )}
                  onClick={() => handleSelect(option.id, option.disabled)}
                >
                  <div>{option.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-3 font-medium">{option.title}</span>
                    <span className="text-1 text-neutral-11">
                      {option.description}
                    </span>
                  </div>
                </Card>
              </TooltipTrigger>
              {option.disabled && option.disabledTooltip && (
                <TooltipContent>{option.disabledTooltip}</TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
};
