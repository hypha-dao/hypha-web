'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RequirementMark,
} from '@hypha-platform/ui';
import { handleNumberChange } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

export function TokenMaxSupplyField() {
  const { setValue, control } = useFormContext();
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

  const handleMaxSupplyChange = handleNumberChange(setValue, 'maxSupply');

  return (
    <FormField
      control={control}
      name="maxSupply"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <div className="flex gap-1 w-full">
              <FormLabel className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                {tAgreementFlow('plugins.issueNewToken.supply.maxSupplyLabel')}
              </FormLabel>
              {enableLimitedSupply && <RequirementMark className="text-2" />}
            </div>
            <FormControl>
              <Input
                type="number"
                placeholder={tAgreementFlow(
                  'plugins.issueNewToken.supply.maxSupplyPlaceholder',
                )}
                value={maxSupply}
                onChange={handleMaxSupplyChange}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
