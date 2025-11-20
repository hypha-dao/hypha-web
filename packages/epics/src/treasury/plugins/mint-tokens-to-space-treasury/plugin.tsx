'use client';

import {
  Separator,
  Skeleton,
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { TokenPayoutField } from '../../../agreements/plugins/components/common/token-payout-field';
import { useTokens } from '../../hooks';
import { useFormContext } from 'react-hook-form';
import { Token } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

export const MintTokensToSpaceTreasuryPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
}) => {
  const { lang } = useParams();
  const { control, setValue } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const filteredTokens = tokens.filter(
    (t: ExtendedToken) => t?.space?.slug === spaceSlug,
  );
  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isLoading} width={'100%'} height={90}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              Select Token
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <div className="flex md:justify-end">
              <FormField
                control={control}
                name="mint"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <TokenPayoutField
                        value={field.value}
                        onChange={(val) => setValue('mint', val)}
                        tokens={filteredTokens}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        <div className="text-2 text-foreground">
          Your space has not yet created a token,{' '}
          <Link
            href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
            className="text-accent-9 underline"
            onClick={(e) => e.stopPropagation()}
          >
            click here
          </Link>{' '}
          to first issue a token
        </div>
      </Skeleton>
    </div>
  );
};
