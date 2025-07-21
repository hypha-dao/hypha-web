'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { ChevronDownIcon } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type Option = {
  value: string;
  label: string;
  [key: string]: any;
};

type ComboboxProps = {
  options: Option[];
  placeholder?: string;
  onChange?: (value: string) => void;
  renderOption?: (option: Option) => React.ReactNode;
  renderValue?: (option: Option | undefined) => React.ReactNode;
  initialValue?: string;
};

export function Combobox({
  options,
  placeholder = '',
  onChange,
  renderOption,
  renderValue,
  initialValue = '',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(initialValue);

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? '' : currentValue;
    setValue(newValue);
    onChange?.(newValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          aria-expanded={open}
          className="w-full text-2 md:w-72 justify-between py-2 font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            {renderValue
              ? renderValue(selectedOption)
              : selectedOption?.label || placeholder}
          </div>
          <ChevronDownIcon className="size-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full md:w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandList className="rounded-lg">
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <div className="flex items-center gap-2 w-full">
                    {renderOption ? renderOption(option) : option.label}
                    <Check
                      className={cn(
                        'ml-auto',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
