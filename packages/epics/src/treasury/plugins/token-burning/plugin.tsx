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
import { ChevronDownIcon } from '@radix-ui/themes';
import { useFormContext, useWatch } from 'react-hook-form';
import { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { ExtendedToken, useTokens } from '../../hooks/use-tokens';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TokenBurnTargetsFieldArray } from './token-burn-targets-field-array';
import { getTokenTypeLabel } from '../../components/common/token-type-field';

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
  const selectedTokenData = filteredTokens.find(
    (token: ExtendedToken) => token.address === selectedToken,
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
