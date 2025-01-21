import React from 'react';
import * as Select from '@radix-ui/react-select';
import { clsx } from 'clsx';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons';

type SelectMenuProps = {
  children: React.ReactNode;
  value: string;
  onValueChange?: (value: string) => void;
  variant?: 'default' | 'ghost';
};

export const SelectMenu: React.FC<SelectMenuProps> = ({
  children,
  value,
  onValueChange,
  variant = 'default',
}) => (
  <Select.Root value={value} onValueChange={onValueChange}>
    <Select.Trigger
      className={clsx(
        'inline-flex items-center justify-center rounded px-[15px] text-[13px] leading-none h-[35px] gap-[5px] border outline-none',
        {
          'text-violet11 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9':
            variant === 'default',
          'text-sm bg-transparent text-violet9 border-none hover:bg-transparent':
            variant === 'ghost',
        }
      )}
      aria-label="Food"
    >
      <Select.Value placeholder="Select a fruit…" />
      <Select.Icon className="text-violet11">
        <ChevronDownIcon />
      </Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="overflow-hidden rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
        <Select.ScrollUpButton className="flex items-center justify-center h-[25px] text-violet11 cursor-default">
          <ChevronUpIcon />
        </Select.ScrollUpButton>
        <Select.Viewport className="p-[5px]">{children}</Select.Viewport>
        <Select.ScrollDownButton className="flex items-center justify-center h-[25px] text-violet11 cursor-default">
          <ChevronDownIcon />
        </Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
);

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; value: string; className?: string }
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <Select.Item
      className={clsx(
        'text-[13px] leading-none text-violet11 rounded-[3px] flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:outline-none data-[highlighted]:bg-violet9 data-[highlighted]:text-violet1',
        className
      )}
      {...props}
      ref={forwardedRef}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
        <CheckIcon />
      </Select.ItemIndicator>
    </Select.Item>
  );
});

export const SelectGroup = Select.Group;
export const SelectLabel = Select.Label;
export const SelectSeparator = Select.Separator;
