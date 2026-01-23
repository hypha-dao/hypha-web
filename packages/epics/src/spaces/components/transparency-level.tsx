'use client';

import {
  Card,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import clsx from 'clsx';
import { PlusCircledIcon } from '@radix-ui/react-icons';

export enum TransparencyLevel {
  PUBLIC = 0,
  NETWORK = 1,
  ORGANISATION = 2,
  SPACE = 3,
}

type TransparencyLevelComponentProps = {
  value?: TransparencyLevel;
  onChange?: (selected: TransparencyLevel) => void;
  options: TransparencyOption[];
  label?: string;
};

export type TransparencyOption = {
  id: TransparencyLevel;
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
};

export const TransparencyLevelComponent = ({
  onChange,
  value,
  options,
  label,
}: TransparencyLevelComponentProps) => {
  const handleSelect = (selection: TransparencyLevel, disabled?: boolean) => {
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
          {label && <label className="text-sm text-neutral-11">{label}</label>}
          {options.map((option) => (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <Card
                  className={clsx(
                    'flex p-5 cursor-pointer space-x-4 items-center border-2 w-full',
                    {
                      'border-accent-9': equalNumbers(
                        value,
                        option.id,
                        TransparencyLevel.PUBLIC,
                      ),
                      'opacity-50 cursor-not-allowed': option.disabled,
                      'hover:border-accent-5': !option.disabled,
                    },
                  )}
                  onClick={() => handleSelect(option.id, option.disabled)}
                >
                  <div>{option.icon || <PlusCircledIcon />}</div>
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
