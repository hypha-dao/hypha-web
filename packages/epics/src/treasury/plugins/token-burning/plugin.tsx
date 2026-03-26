'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RequirementMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { Person, Space, Token } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { useTokens } from '../../hooks';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TokenBurnTargetsFieldArray } from './token-burn-targets-field-array';

interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

export const TokenBurningPlugin = ({
  spaceSlug,
  members = [],
  spaces = [],
}: {
  spaceSlug: string;
  members?: Person[];
  spaces?: Space[];
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { lang } = useParams();
  const { control } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const selectedToken = useWatch({
    control,
    name: 'tokenBurning.token',
  }) as string | undefined;

  const filteredTokens = tokens.filter(
    (token: ExtendedToken) => token?.space?.slug === spaceSlug,
  );

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isLoading} width="100%" height={90}>
        <div className="flex flex-col gap-3">
          <FormLabel>
            {tAgreementFlow('plugins.tokenBurning.selectToken')}
          </FormLabel>
          <span className="text-2 text-neutral-11">
            {tAgreementFlow('plugins.tokenBurning.selectTokenDescription')}
          </span>
        </div>

        <FormField
          control={control}
          name="tokenBurning.token"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center w-full">
                <div className="flex gap-1 w-full">
                  <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                    {tAgreementFlow('plugins.tokenBurning.tokenLabel')}
                  </label>
                  <RequirementMark className="text-2" />
                </div>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                    disabled={filteredTokens.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          filteredTokens.length === 0
                            ? tAgreementFlow(
                                'plugins.tokenBurning.noTokenFound',
                              )
                            : tAgreementFlow(
                                'plugins.tokenBurning.selectTokenPlaceholder',
                              )
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTokens.map((token: ExtendedToken) => (
                        <SelectItem key={token.address} value={token.address}>
                          {token.symbol} - {token.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {filteredTokens.length === 0 && (
          <div className="text-2 text-foreground">
            {tAgreementFlow('plugins.tokenBurning.noTokensPrefix')}{' '}
            <Link
              href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
              className="text-accent-9 underline"
              onClick={(event) => event.stopPropagation()}
            >
              {tAgreementFlow('plugins.tokenBurning.clickHere')}
            </Link>{' '}
            {tAgreementFlow('plugins.tokenBurning.noTokensSuffix')}
          </div>
        )}
      </Skeleton>

      {selectedToken && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <FormLabel>
              {tAgreementFlow('plugins.tokenBurning.tokenBurn')}
            </FormLabel>
            <span className="text-2 text-neutral-11">
              {tAgreementFlow('plugins.tokenBurning.tokenBurnDescription')}
            </span>
          </div>

          <TokenBurnTargetsFieldArray members={members} spaces={spaces} />
        </div>
      )}
    </div>
  );
};
