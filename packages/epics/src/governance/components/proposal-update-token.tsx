import {
  getPriceCurrencyCode,
  useJwt,
  useUpdateTokenByAddress,
} from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import {
  formatCurrencyValue,
  formatDecayInterval,
} from '@hypha-platform/ui-utils';
import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export interface ProposalUpdateTokenProps {
  address: `0x${string}`;
  name?: string;
  symbol?: string;
  maxSupply?: bigint;
  transferable?: boolean;
  autoMinting?: boolean;
  priceWithCurrency?: {
    tokenPrice: bigint;
    priceCurrencyFeed: string;
  };
  decayPercentage?: bigint;
  decayInterval?: bigint;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  archiveToken?: boolean;
}

interface TokenUpdateDataInterface {
  iconUrl?: string;
}

export const ProposalUpdateToken = ({
  address,
  name,
  symbol,
  maxSupply,
  transferable,
  autoMinting,
  priceWithCurrency,
  decayPercentage,
  decayInterval,
  useTransferWhitelist,
  useReceiveWhitelist,
  archiveToken,
}: ProposalUpdateTokenProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const { jwt: authToken } = useJwt();
  const { tokenUpdate, isLoading: isTokenUpdateLoading } =
    useUpdateTokenByAddress({
      address,
      authToken: authToken ?? undefined,
    });
  const tokenIcon = React.useMemo(() => {
    return isTokenUpdateLoading
      ? undefined
      : (tokenUpdate?.data as TokenUpdateDataInterface)?.iconUrl;
  }, [isTokenUpdateLoading, tokenUpdate]);
  const tokenPrice = React.useMemo(() => {
    return priceWithCurrency?.tokenPrice
      ? Number(priceWithCurrency.tokenPrice) / 1_000_000
      : undefined;
  }, [priceWithCurrency]);
  const priceCurrencyFeed = React.useMemo(() => {
    if (priceWithCurrency?.priceCurrencyFeed === undefined) {
      return undefined;
    }
    return getPriceCurrencyCode(
      priceWithCurrency.priceCurrencyFeed as `0x${string}`,
    );
  }, [priceWithCurrency]);

  // On-chain max supply uses 18 decimals (wei); match ProposalTokenItem scaling.
  const maxSupplyHuman = React.useMemo(() => {
    if (maxSupply === undefined) return undefined;
    return Number(maxSupply / 10n ** 18n);
  }, [maxSupply]);

  return (
    <div className="flex flex-col gap-5">
      {name !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenName')}
          </div>
          <div className="text-1 text-nowrap">{name}</div>
        </div>
      )}
      {symbol !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenSymbol')}
          </div>
          <div className="text-1">{symbol}</div>
        </div>
      )}
      {tokenIcon && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenIcon')}
          </div>
          <Image
            className="rounded-full w-8 h-8"
            width={32}
            height={32}
            src={tokenIcon}
            alt={tProposalDetails('labels.tokenIcon')}
          />
        </div>
      )}
      {maxSupply !== undefined && maxSupplyHuman !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.maxSupply')}
          </div>
          <div className="text-1">
            {maxSupplyHuman === 0
              ? tProposalDetails('labels.unlimited')
              : formatCurrencyValue(maxSupplyHuman)}
          </div>
        </div>
      )}
      {transferable !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.transferable')}
          </div>
          <div className="text-1">
            {transferable
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {autoMinting !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.autoMinting')}
          </div>
          <div className="text-1">
            {autoMinting
              ? tProposalDetails('labels.enabled')
              : tProposalDetails('labels.disabled')}
          </div>
        </div>
      )}
      {archiveToken !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.archived')}
          </div>
          <div className="text-1">
            {archiveToken
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {tokenPrice !== undefined && priceCurrencyFeed && (
        <div className="flex justify-between items-center text-nowrap">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenPrice')}
          </div>
          <div className="text-1">
            {formatCurrencyValue(tokenPrice)} {priceCurrencyFeed}
          </div>
        </div>
      )}
      {decayPercentage !== undefined && decayInterval !== undefined && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="text-1 text-neutral-11 font-medium">
              {tProposalDetails('sections.decaySettings')}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.decayPercentage')}
              </div>
              <div className="text-1">{Number(decayPercentage)}%</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                {tProposalDetails('labels.decayInterval')}
              </div>
              <div className="text-1 text-nowrap">
                {formatDecayInterval(decayInterval)}
              </div>
            </div>
          </div>
        </>
      )}
      {useTransferWhitelist !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.useTransferWhitelist')}
          </div>
          <div className="text-1">
            {useTransferWhitelist
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {useReceiveWhitelist !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.useReceiveWhitelist')}
          </div>
          <div className="text-1">
            {useReceiveWhitelist
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
    </div>
  );
};
