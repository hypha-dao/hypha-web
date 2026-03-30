'use client';

import React from 'react';
import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import {
  Separator,
  Skeleton,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';

export const AcceptInvestmentPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { control, watch, setValue } = useFormContext();
  const t = useTranslations('AgreementFlow.plugins.acceptInvestment');

  const receiveLeg0 = watch('spaceReceiveLegs.0');
  React.useEffect(() => {
    if (
      receiveLeg0 &&
      typeof receiveLeg0 === 'object' &&
      receiveLeg0.source === undefined
    ) {
      setValue('spaceReceiveLegs.0.source', 'mint', { shouldValidate: false });
    }
  }, [receiveLeg0, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label={t('investingMember')}
      />
      <Separator />
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={tokens}
          name="investorSendLegs"
          label={t('investorWillSend')}
          allowAddOrRemove={false}
        />
      </Skeleton>
      <Separator />
      <Skeleton loading={isLoading} width={'100%'} height={120}>
        <div className="flex flex-col gap-3 w-full">
          <TokenPayoutFieldArray
            tokens={tokens}
            name="spaceReceiveLegs"
            label={t('spaceWillProvide')}
            allowAddOrRemove={false}
          />
          <FormField
            control={control}
            name="spaceReceiveLegs.0.source"
            render={({ field }) => (
              <FormItem>
                <label className="text-2 text-neutral-11 block mb-1">
                  {t('source')}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('sourcePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mint">{t('sourceMint')}</SelectItem>
                    <SelectItem value="treasury">
                      {t('sourceTreasury')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Skeleton>
    </div>
  );
};
