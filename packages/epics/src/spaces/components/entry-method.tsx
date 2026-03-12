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
import { useTranslations } from 'next-intl';

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

export const EntryMethod = ({ onChange, value }: EntryMethodProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const entryMethods: EntryMethodOption[] = [
    {
      id: EntryMethodType.OPEN_ACCESS,
      title: tAgreementFlow('plugins.entryMethod.openAccessTitle'),
      disabled: false,
      icon: <PlusCircledIcon />,
      description: tAgreementFlow('plugins.entryMethod.openAccessDescription'),
    },
    {
      id: EntryMethodType.INVITE_ONLY,
      title: tAgreementFlow('plugins.entryMethod.inviteRequestTitle'),
      disabled: false,
      icon: <PlusCircledIcon />,
      description: tAgreementFlow('plugins.entryMethod.inviteRequestDescription'),
    },
    {
      id: EntryMethodType.TOKEN_BASED,
      title: tAgreementFlow('plugins.entryMethod.tokenBasedTitle'),
      disabled: false,
      icon: <PlusCircledIcon />,
      description: tAgreementFlow('plugins.entryMethod.tokenBasedDescription'),
    },
  ];
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
          <label className="text-sm text-neutral-11">
            {tAgreementFlow('plugins.entryMethod.label')}
          </label>
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
