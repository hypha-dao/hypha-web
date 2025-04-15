'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@hypha-platform/lib/utils';
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
};

export function Combobox({
  options,
  placeholder = '',
  onChange,
  renderOption,
  renderValue,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

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
          className="w-[220px] justify-between text-secondary-foreground"
        >
          <div className="flex items-center gap-2 truncate">
            {renderValue
              ? renderValue(selectedOption)
              : selectedOption?.label || placeholder}
          </div>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
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
