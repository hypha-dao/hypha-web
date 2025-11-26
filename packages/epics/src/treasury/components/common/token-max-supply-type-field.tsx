'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { ChevronDownIcon } from '@radix-ui/themes';

const OPTIONS = [
  { label: 'Forever Immutable', value: 'immutable' },
  { label: 'Updatable Over Time', value: 'updatable' },
];

export function TokenMaxSupplyTypeField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="maxSupplyType"
      render={({ field }) => {
        const selectedLabel = field.value?.label || 'Select max supply type';

        return (
          <FormItem>
            <div className="flex justify-between items-center w-full">
              <FormLabel className="text-2 text-neutral-11">
                Max Supply Type
              </FormLabel>

              <FormControl>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      colorVariant="neutral"
                      role="combobox"
                      className="w-full md:w-72 justify-between py-2 font-normal"
                    >
                      <span className="text-2 text-neutral-11">
                        {selectedLabel}
                      </span>
                      <ChevronDownIcon className="size-2" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-full">
                    {OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onSelect={() => field.onChange(opt)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </FormControl>
            </div>

            <div className="text-2 text-neutral-11 flex flex-col gap-3">
              <span>
                Choosing 'Forever Immutable' makes the maximum supply permanent
                and prevents any future changes.
              </span>
              <span>
                Select 'Updatable Over Time' for future increases (e.g., gradual
                or milestone-based releases), or keep supply unlimited by
                leaving limited supply disabled.
              </span>
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
