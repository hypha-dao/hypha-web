'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
  RequirementMark,
  Skeleton,
} from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { ChevronDownIcon } from '@radix-ui/themes';
import { useFormContext, useWatch } from 'react-hook-form';
import { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { ExtendedToken, useTokens } from '../../hooks/use-tokens';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TokenBurnTargetsFieldArray } from './token-burn-targets-field-array';
import { getTokenTypeLabel } from '../../components/common/token-type-field';
import { useEffect } from 'react';
import { useTokenSupply } from '../../hooks';
import { useDbTokens } from '../../../hooks';

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
  const { control, setValue } = useFormContext();
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { tokens: dbTokens } = useDbTokens();
  const selectedToken = useWatch({
    control,
    name: 'tokenBurning.token',
  }) as string | undefined;
  const selectedTokenLower = selectedToken?.toLowerCase();

  const filteredTokens = tokens.filter(
    (token: ExtendedToken) => token?.space?.slug === spaceSlug,
  );
  const selectedTokenData = filteredTokens.find(
    (token: ExtendedToken) =>
      token.address.toLowerCase() === selectedTokenLower,
  );
  const selectedDbToken = dbTokens
    .filter((token) => token.address)
    .find((token) => token.address?.toLowerCase() === selectedTokenLower);
  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedDbToken?.address as `0x${string}`,
  );
  const isSelectedTokenValid = Boolean(selectedTokenData);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (selectedToken && !selectedTokenData) {
      setValue('tokenBurning.token', '');
      setValue('tokenBurning.burns', [
        {
          type: 'member',
          address: '',
          amount: '',
          allBalance: false,
        },
      ]);
    }
  }, [isLoading, selectedToken, selectedTokenData, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isLoading} width="100%" height={90}>
        <div className="flex flex-col gap-2">
          <FormLabel>
            {tAgreementFlow('plugins.tokenBurning.tokenBurn')}
          </FormLabel>
          <span className="text-2 text-neutral-11">
            {tAgreementFlow('plugins.tokenBurning.tokenBurnDescription')}
          </span>
        </div>

        <div className="border-t border-neutral-6" />

        <div className="flex flex-col gap-3">
          <FormLabel>
            {tAgreementFlow('plugins.tokenBurning.selectToken')}
          </FormLabel>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        colorVariant="neutral"
                        role="combobox"
                        disabled={filteredTokens.length === 0}
                        className="w-full text-2 md:w-72 justify-between py-2 font-normal"
                      >
                        <div className="flex items-center gap-2">
                          {selectedTokenData ? (
                            <>
                              <Image
                                src={
                                  selectedTokenData.icon ??
                                  '/placeholder/neutral-token-icon.svg'
                                }
                                width={20}
                                height={20}
                                alt={selectedTokenData.symbol}
                                className="mr-2 rounded-full h-4 w-4"
                              />
                              <span className="text-2 text-neutral-11">
                                {selectedTokenData.symbol}
                              </span>
                            </>
                          ) : (
                            <span className="text-2 text-neutral-11 whitespace-nowrap">
                              {filteredTokens.length === 0
                                ? tAgreementFlow(
                                    'plugins.tokenBurning.noTokenFound',
                                  )
                                : tAgreementFlow(
                                    'plugins.tokenBurning.selectTokenPlaceholder',
                                  )}
                            </span>
                          )}
                        </div>
                        <ChevronDownIcon className="size-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
                      {filteredTokens.length > 0 ? (
                        filteredTokens.map((token: ExtendedToken) => (
                          <DropdownMenuItem
                            key={token.address}
                            onSelect={() => field.onChange(token.address)}
                          >
                            <Image
                              src={
                                token.icon ??
                                '/placeholder/neutral-token-icon.svg'
                              }
                              width={24}
                              height={24}
                              alt={token.symbol}
                              className="mr-2 rounded-full h-5 w-5"
                            />
                            <div className="flex flex-col">
                              <span className="flex gap-2 items-center">
                                <span className="text-2 text-neutral-11">
                                  {token.symbol}
                                </span>
                                {token.type ? (
                                  <div className="rounded-lg text-[10px] text-accent-11 border-1 border-accent-11 px-2 py-0.75">
                                    {getTokenTypeLabel(
                                      token.type,
                                      tAgreementFlow,
                                    )}
                                  </div>
                                ) : null}
                              </span>
                              {token?.space?.title ? (
                                <span className="text-1 text-accent-11">
                                  {tAgreementFlow(
                                    'plugins.tokenPayoutField.bySpace',
                                    {
                                      space: token.space.title,
                                    },
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <span className="text-2 text-neutral-11">
                          {tAgreementFlow(
                            'plugins.tokenPayoutField.noTokensFound',
                          )}
                        </span>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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

      {isSelectedTokenValid && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-2 text-neutral-11 w-full">
              {tAgreementFlow('plugins.tokenBurning.tokenSupply')}
            </span>
            {selectedDbToken?.maxSupply === 0 ? (
              <span className="text-2 text-neutral-11 text-nowrap">
                {tAgreementFlow('plugins.tokenBurning.unlimitedSupply')}
              </span>
            ) : (
              <span className="text-2 text-neutral-11">
                {formatCurrencyValue(Number(selectedDbToken?.maxSupply ?? 0))}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2 text-neutral-11">
              {tAgreementFlow('plugins.tokenBurning.issuanceToDate')}
            </span>
            <Skeleton width={120} height={32} loading={isLoadingSupply}>
              <span className="text-2 text-neutral-11">
                {formatCurrencyValue(Number(supply ?? 0))}
              </span>
            </Skeleton>
          </div>

          <div className="border-t border-neutral-6" />

          <TokenBurnTargetsFieldArray
            members={members}
            spaces={spaces}
            selectedTokenAddress={selectedTokenData?.address}
            selectedTokenSymbol={selectedTokenData?.symbol}
          />
        </div>
      )}
    </div>
  );
};
