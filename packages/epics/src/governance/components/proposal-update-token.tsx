import {
  getPriceCurrencyCode,
  useJwt,
  useUpdateTokenByAddress,
} from '@hypha-platform/core/client';
import { Badge, Separator } from '@hypha-platform/ui';
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
  /** Same document status as the proposal header (e.g. accepted → "Accepted" badge). */
  proposalStatus?: string | null;
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
  proposalStatus,
}: ProposalUpdateTokenProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const { jwt: authToken } = useJwt();

  const statusBadge = React.useMemo(() => {
    switch (proposalStatus) {
      case 'accepted':
        return {
          text: tProposalDetails('status.accepted'),
          colorVariant: 'success' as const,
        };
      case 'rejected':
        return {
          text: tProposalDetails('status.rejected'),
          colorVariant: 'error' as const,
        };
      case 'onVoting':
        return {
          text: tProposalDetails('status.onVoting'),
          colorVariant: 'warn' as const,
        };
      default:
        return null;
    }
  }, [proposalStatus, tProposalDetails]);
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
      {statusBadge && (
        <div className="flex gap-2">
          <Badge
            variant="outline"
            colorVariant={statusBadge.colorVariant}
            isLoading={false}
          >
            {statusBadge.text}
          </Badge>
        </div>
      )}
      {name !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Token Name</div>
          <div className="text-1 text-nowrap">{name}</div>
        </div>
      )}
      {symbol !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Token Symbol</div>
          <div className="text-1">{symbol}</div>
        </div>
      )}
      {tokenIcon && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Token Icon</div>
          <Image
            className="rounded-full w-8 h-8"
            width={32}
            height={32}
            src={tokenIcon}
            alt="Token Icon"
          />
        </div>
      )}
      {maxSupply !== undefined && maxSupplyHuman !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Max Supply</div>
          <div className="text-1">
            {maxSupplyHuman === 0
              ? tProposalDetails('labels.unlimited')
              : formatCurrencyValue(maxSupplyHuman)}
          </div>
        </div>
      )}
      {transferable !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Transferable</div>
          <div className="text-1">{transferable ? 'Yes' : 'No'}</div>
        </div>
      )}
      {autoMinting !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Auto Minting</div>
          <div className="text-1">{autoMinting ? 'Enabled' : 'Disabled'}</div>
        </div>
      )}
      {archiveToken !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">Archived</div>
          <div className="text-1">{archiveToken ? 'Yes' : 'No'}</div>
        </div>
      )}
      {tokenPrice !== undefined && priceCurrencyFeed && (
        <div className="flex justify-between items-center text-nowrap">
          <div className="text-1 text-neutral-11 w-full">Token Price</div>
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
              Decay Settings
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                Decay Percentage
              </div>
              <div className="text-1">{Number(decayPercentage)}%</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-1 text-neutral-11 w-full">
                Decay Interval
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
            Use Transfer Whitelist
          </div>
          <div className="text-1">{useTransferWhitelist ? 'Yes' : 'No'}</div>
        </div>
      )}
      {useReceiveWhitelist !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            Use Receive Whitelist
          </div>
          <div className="text-1">{useReceiveWhitelist ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};
