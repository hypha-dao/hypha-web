'use client';

import { useFormContext, useWatch } from 'react-hook-form';
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
  RequirementMark,
} from '@hypha-platform/ui';
import { ChevronDownIcon } from '@radix-ui/themes';
import { useTranslations } from 'next-intl';

const OPTIONS = [
  {
    label: 'Forever Immutable',
    value: 'immutable',
    labelKey: 'plugins.issueNewToken.supply.maxSupplyTypeOptions.immutable',
  },
  {
    label: 'Updatable Over Time',
    value: 'updatable',
    labelKey: 'plugins.issueNewToken.supply.maxSupplyTypeOptions.updatable',
  },
];

type TokenMaxSupplyTypeFieldProps = {
  /** Voice/update flow: cap type is fixed on-chain and cannot be changed via proposal */
  readOnly?: boolean;
};

export function TokenMaxSupplyTypeField({
  readOnly = false,
}: TokenMaxSupplyTypeFieldProps) {
  const { control, trigger, formState } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const maxSupply = useWatch({
    control,
    name: 'maxSupply',
    defaultValue: 0,
  });
  const enableLimitedSupply = useWatch({
    control,
    name: 'enableLimitedSupply',
    defaultValue: false,
  });

  const maxSupplyError = formState.errors.maxSupply?.message as
    | string
    | undefined;

  return (
    <FormField
      control={control}
      name="maxSupplyType"
      render={({ field }) => {
        const selectedOption = OPTIONS.find(
          (option) => option.value === field.value?.value,
        );
        const selectedLabel = selectedOption
          ? tAgreementFlow(
              selectedOption.labelKey as Parameters<typeof tAgreementFlow>[0],
            )
          : field.value?.label ||
            tAgreementFlow(
              'plugins.issueNewToken.supply.maxSupplyTypePlaceholder',
            );

        const readOnlyTitle = readOnly
          ? tAgreementFlow(
              'plugins.issueNewToken.supply.maxSupplyTypeReadOnlyWhenImmutableOnChain',
            )
          : undefined;

        return (
          <FormItem>
            <div className="flex justify-between items-center w-full">
              <div className="flex gap-1 w-full">
                <FormLabel className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                  {tAgreementFlow(
                    'plugins.issueNewToken.supply.maxSupplyTypeLabel',
                  )}
                </FormLabel>
                {enableLimitedSupply && <RequirementMark className="text-2" />}
              </div>

              <FormControl>
                {readOnly ? (
                  <div
                    className="flex w-full md:w-72 items-center justify-between rounded-md border border-neutral-6 bg-neutral-2 px-3 py-2 text-left cursor-not-allowed"
                    title={readOnlyTitle}
                  >
                    <span className="text-2 text-neutral-11">
                      {selectedLabel}
                    </span>
                  </div>
                ) : (
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
                          onSelect={() => {
                            field.onChange({
                              label: opt.label,
                              value: opt.value,
                            });
                            trigger('maxSupply');
                          }}
                        >
                          {tAgreementFlow(
                            opt.labelKey as Parameters<
                              typeof tAgreementFlow
                            >[0],
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </FormControl>
            </div>
            <FormMessage />
            {maxSupplyError && (
              <div className="text-sm font-medium text-destructive">
                {maxSupplyError}
              </div>
            )}
            <div className="text-2 text-neutral-11 flex flex-col gap-3">
              <span>
                {tAgreementFlow(
                  'plugins.issueNewToken.supply.maxSupplyTypeHelp',
                )}
              </span>
            </div>
          </FormItem>
        );
      }}
    />
  );
}
