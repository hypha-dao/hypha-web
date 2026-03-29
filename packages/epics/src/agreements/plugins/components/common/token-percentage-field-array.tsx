'use client';

import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import {
  ConversionAssetDropdown,
  ConversionFieldDetails,
  ConversionPercentageInput,
  type TokenPercentageAsset,
} from './token-percentage-field';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';

export type { TokenPercentageAsset };

export interface TokenPercentageFieldArrayProps {
  assets: TokenPercentageAsset[];
  name?: string;
  label?: string;
  onRemoveRebalance?: (remainingAssets: TokenPercentageAsset[]) => void;
  showEmptyFieldMessage?: boolean;
  showFieldDetails?: boolean;
}

type ConversionRowErrors = Array<{
  asset?: { message?: string };
  percentage?: { message?: string };
}>;

export const TokenPercentageFieldArray = ({
  assets,
  name = 'conversions',
  label = 'Converted into',
  onRemoveRebalance,
  showEmptyFieldMessage: _showEmptyFieldMessage = false,
  showFieldDetails = false,
}: TokenPercentageFieldArrayProps) => {
  void _showEmptyFieldMessage;
  const {
    control,
    getValues,
    trigger,
    clearErrors,
    formState: { errors },
  } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const watchedRows = useWatch({ control, name }) as
    | Array<{ asset?: string; percentage?: string }>
    | undefined;

  React.useEffect(() => {
    if (!watchedRows?.length) return;
    watchedRows.forEach((row, index) => {
      const trimmed = (row?.asset ?? '').trim();
      if (!trimmed) return;
      const matchesCollateral = assets.some(
        (a) => a.address.toLowerCase() === trimmed.toLowerCase(),
      );
      if (matchesCollateral) {
        clearErrors(`${name}.${index}.asset`);
      }
    });
  }, [watchedRows, assets, name, clearErrors]);

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({ percentage: '0.00', asset: '' });
  };

  const handleRemoveField = (
    e: React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    e.preventDefault();
    if (fields.length > 1) {
      const currentRows = (getValues(name) as Array<{
        asset: string;
        percentage: string;
      }>) ?? [{ asset: '', percentage: '100.00' }];
      const remainingAssets = currentRows
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row) =>
          assets.find(
            (asset) =>
              asset.address.toLowerCase() === (row.asset ?? '').toLowerCase(),
          ),
        )
        .filter((asset): asset is TokenPercentageAsset => !!asset);
      remove(index);
      onRemoveRebalance?.(remainingAssets);
    }
  };

  const conversionErrors = errors[name] as ConversionRowErrors | undefined;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
          {label} <RequirementMark />
        </label>
        <div className="flex flex-col gap-2 grow min-w-0">
          {fields.map((field, index) => {
            const rowAssetAddress = watchedRows?.[index]?.asset ?? '';
            const selectedDetailAsset = assets.find(
              (a) => a.address.toLowerCase() === rowAssetAddress.toLowerCase(),
            );
            const assetFieldError = conversionErrors?.[index]?.asset;
            const percentageFieldError = conversionErrors?.[index]?.percentage;
            const showRowMessages =
              Boolean(assetFieldError) || Boolean(percentageFieldError);

            return (
              <div key={field.id} className="flex md:justify-end gap-2">
                <div className="flex flex-col gap-1 grow min-w-0 max-w-full">
                  <div className="flex flex-row flex-nowrap items-end gap-2 w-full min-w-0">
                    <FormField
                      control={control}
                      name={`${name}.${index}.asset`}
                      render={({ field: assetField }) => (
                        <FormItem className="flex-1 min-w-0 space-y-0 gap-0">
                          <FormControl>
                            <ConversionAssetDropdown
                              value={assetField.value ?? ''}
                              onChange={(address) => {
                                assetField.onChange(address);
                                void trigger(`${name}.${index}.asset`);
                              }}
                              assets={assets}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`${name}.${index}.percentage`}
                      render={({ field: pctField }) => (
                        <FormItem className="shrink-0 space-y-0 gap-0 w-[6.75rem]">
                          <FormControl>
                            <ConversionPercentageInput
                              value={pctField.value ?? ''}
                              onChange={(percentage) => {
                                pctField.onChange(percentage);
                                void trigger(`${name}.${index}.percentage`);
                              }}
                              className="w-[6.75rem] shrink-0 max-w-[6.75rem]"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {showRowMessages ? (
                    <div className="text-sm font-medium text-destructive space-y-0.5 w-full min-w-0">
                      {assetFieldError?.message ? (
                        <p className="break-words">
                          {String(assetFieldError.message)}
                        </p>
                      ) : null}
                      {percentageFieldError?.message ? (
                        <p className="break-words">
                          {String(percentageFieldError.message)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {showFieldDetails ? (
                    <ConversionFieldDetails asset={selectedDetailAsset} />
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  onClick={(ev) => handleRemoveField(ev, index)}
                  className="px-2 md:px-3 shrink-0 self-end"
                >
                  <Cross2Icon />
                </Button>
              </div>
            );
          })}
          {(errors[name] as { root?: { message?: string } })?.root?.message && (
            <FormMessage>
              {(
                errors[name] as { root?: { message?: string } }
              )?.root?.message?.toString()}
            </FormMessage>
          )}
        </div>
      </div>
      <div className="flex justify-end w-full">
        <Button className="w-fit" onClick={handleAddField} variant="ghost">
          <PlusIcon />
          Add
        </Button>
      </div>
    </div>
  );
};
