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
  searchText: string;
  [key: string]: any;
};

type ComboboxProps = {
  options: Option[];
  placeholder?: string;
  onChange?: (value: string) => void;
  renderOption?: (option: Option) => React.ReactNode;
  renderValue?: (option: Option | undefined) => React.ReactNode;
  initialValue?: string;
  allowEmptyChoise?: boolean;
  className?: string;
};

export function Combobox({
  options,
  placeholder = '',
  onChange,
  renderOption,
  renderValue,
  initialValue = '',
  allowEmptyChoise = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(initialValue);
  const [searchTerm, setSearchTerm] = React.useState('');

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => option.searchText.includes(term));
  }, [options, searchTerm]);

  const handleSelect = (currentValue: string) => {
    const newValue = allowEmptyChoise
      ? currentValue === value
        ? ''
        : currentValue
      : currentValue;
    if (newValue !== value) {
      setValue(newValue);
      onChange?.(newValue);
    }
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full text-2 md:w-72 justify-between py-2 font-normal',
            className,
          )}
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search..."
            className="h-9"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList className="rounded-lg">
            {filteredOptions.length === 0 ? (
              <CommandEmpty>No options found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
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
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
