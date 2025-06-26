'use client';

import {
  Card,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import clsx from 'clsx';
import { EntryMethodType } from '@core/governance/types';
import { PlusCircledIcon } from '@radix-ui/react-icons';

type EntryMethod = {
  name: string;
  value: number;
};

type EntryMethodProps = {
  value?: number;
  onChange?: (selected: EntryMethodType) => void;
  isLoading?: boolean;
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
    description: 'Join to space immediately',
  },
  {
    id: EntryMethodType.INVITE_ONLY,
    title: 'Invite Only',
    disabled: false,
    icon: <PlusCircledIcon />,
    description: 'Join to space by invite only',
  },
  {
    id: EntryMethodType.TOKEN_BASED,
    title: 'Token Based',
    disabled: false,
    icon: <PlusCircledIcon />,
    description: 'Join to space only when match token requirements',
  },
];

export const EntryMethod = ({ onChange, value, isLoading }: EntryMethodProps) => {
  const handleSelect = (value: EntryMethodType, disabled?: boolean) => {
    if (disabled) return;
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full justify-between items-center gap-2">
        <div className="flex flex-col gap-4 w-full">
          <label className="text-sm text-neutral-11">Entry Method</label>
          {entryMethods.map((option) => (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <Skeleton loading={isLoading ?? false}>
                  <Card
                    className={clsx(
                      'flex p-5 cursor-pointer space-x-4 items-center border-2 w-full',
                      {
                        'border-accent-9': value === option.id,
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
                </Skeleton>
                
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
