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
  CommandSeparator,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Label } from './label';

type Option = {
  value: string;
  label: string;
  searchText?: string;
  [key: string]: any;
};

type ComboboxProps = {
  options: Option[];
  placeholder?: string;
  onChange?: (value: string) => void;
  renderOption?: (option: Option) => React.ReactNode;
  renderValue?: (option: Option | undefined) => React.ReactNode;
  initialValue?: string;
  allowEmptyChoice?: boolean;
  className?: string;
  disabled?: boolean;
  emptyListMessage?: string;
};

export const COMBOBOX_TITLE = '===';
export const COMBOBOX_DELIMITER = '---';

export function Combobox({
  options,
  placeholder = '',
  onChange,
  renderOption,
  renderValue,
  initialValue = '',
  allowEmptyChoice = true,
  className,
  disabled = false,
  emptyListMessage = 'No options found.',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(initialValue);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => {
      const haystack = (option.searchText ?? option.label ?? '').toLowerCase();
      return haystack.includes(term);
    });
  }, [options, searchTerm]);

  const handleSelect = (currentValue: string) => {
    if (disabled) return;
    const isSameSelection = currentValue === value;
    const newValue = allowEmptyChoice && isSameSelection ? '' : currentValue;
    if (newValue !== value) {
      setValue(newValue);
      onChange?.(newValue);
    }
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(isOpen) => !disabled && setOpen(isOpen)}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          aria-expanded={open && !disabled}
          className={cn(
            'w-full text-2 md:w-72 justify-between py-2 font-normal',
            disabled && 'pointer-events-none opacity-50',
            className,
          )}
          disabled={disabled}
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
            disabled={disabled}
          />
          <CommandList className="rounded-lg">
            {filteredOptions.length === 0 ? (
              <CommandEmpty>{emptyListMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option, index) =>
                  option.value === COMBOBOX_TITLE ? (
                    <Label key={`${option.value}-${index}`}>
                      {option.label}
                    </Label>
                  ) : option.value.length === 0 ||
                    option.value === COMBOBOX_DELIMITER ? (
                    <CommandSeparator key={`${option.value}-${index}`} />
                  ) : (
                    <CommandItem
                      key={`${option.value}-${index}`}
                      value={option.value}
                      onSelect={handleSelect}
                      disabled={disabled}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {renderOption ? renderOption(option) : option.label}
                        <Check
                          className={cn(
                            'ml-auto',
                            value === option.value
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                      </div>
                    </CommandItem>
                  ),
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
