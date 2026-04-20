'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useChainId } from 'wagmi';
import { usePersonByWeb3Address } from '../hooks';
import { Image } from '@hypha-platform/ui';
import { useTokens, ExtendedToken } from '../../treasury';
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import { useDbSpaces } from '../../hooks';
import {
  DbToken,
  getEscrowImplementationAddress,
} from '@hypha-platform/core/client';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

const isEvmAddress = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

const getPreferredAddress = (
  primary?: string,
  fallback?: string,
): string | undefined => {
  if (isEvmAddress(primary)) return primary;
  if (isEvmAddress(fallback)) return fallback;
  return primary || fallback;
};

const getLookupAddress = (address?: string): `0x${string}` | undefined => {
  if (!isEvmAddress(address)) return undefined;
  return address.toLowerCase() as `0x${string}`;
};

function EscrowAddressCopyRow({
  address,
  labelCopied,
  labelCopy,
}: {
  address: `0x${string}`;
  labelCopied: string;
  labelCopy: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = () => {
    copyToClipboard(address);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 text-neutral-11 max-w-full min-w-0"
      aria-label={copied ? labelCopied : labelCopy}
    >
      <span className="truncate">{`${address.slice(0, 6)}…${address.slice(
        -4,
      )}`}</span>
      {copied ? (
        <CheckIcon className="icon-sm shrink-0 text-success-11" aria-hidden />
      ) : (
        <CopyIcon className="icon-sm shrink-0" aria-hidden />
      )}
      {copied ? (
        <span
          className="text-1 text-success-11 whitespace-nowrap"
          role="status"
        >
          {labelCopied}
        </span>
      ) : null}
    </button>
  );
}

interface ProposalExchangeStakesAndTokensDataProps {
  spaceSlug: string;
  sellerAddress?: string;
  buyerAddress?: string;
  fallbackSellerAddress?: string;
  fallbackBuyerAddress?: string;
  sellerLeg: Array<{
    amount: string;
    tokenAddress: string;
  }>;
  buyerLeg: Array<{
    amount: string;
    tokenAddress: string;
  }>;
  escrowId?: bigint;
  completed?: boolean;
  cancelled?: boolean;
  /** Fallback when `useTokens` catalogue omits a minted token (seller leg). */
  dbTokens?: DbToken[];
}

/**
 * Party display matches pay-for-expenses / deploy-funds payment rows
 * (`ProposalTransactionItem`): JWT-backed `usePersonByWeb3Address`, then
 * `useDbSpaces` for space contract addresses.
 */
export const ProposalExchangeStakesAndTokensData = ({
  spaceSlug,
  sellerAddress,
  buyerAddress,
  fallbackSellerAddress,
  fallbackBuyerAddress,
  sellerLeg,
  buyerLeg,
  dbTokens,
}: ProposalExchangeStakesAndTokensDataProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCommon = useTranslations('Common');
  useChainId();
  const escrowContractAddress = getEscrowImplementationAddress();
  const { tokens } = useTokens({ spaceSlug });
  const { spaces: dbSpaces } = useDbSpaces({ parentOnly: false });
  const resolvedSellerAddress = getPreferredAddress(
    sellerAddress,
    fallbackSellerAddress,
  );
  const resolvedBuyerAddress = getPreferredAddress(
    buyerAddress,
    fallbackBuyerAddress,
  );
  const sellerLookupAddress = getLookupAddress(resolvedSellerAddress);
  const buyerLookupAddress = getLookupAddress(resolvedBuyerAddress);
  const { person: sellerPerson } = usePersonByWeb3Address(
    sellerLookupAddress ?? ZERO_ADDRESS,
  );
  const { person: buyerPerson } = usePersonByWeb3Address(
    buyerLookupAddress ?? ZERO_ADDRESS,
  );

  const sellerSpace = resolvedSellerAddress
    ? dbSpaces.find(
        (s) => s.address?.toLowerCase() === resolvedSellerAddress.toLowerCase(),
      )
    : undefined;
  const buyerSpace = resolvedBuyerAddress
    ? dbSpaces.find(
        (s) => s.address?.toLowerCase() === resolvedBuyerAddress.toLowerCase(),
      )
    : undefined;

  const sellerResolvedAsSpace = !sellerPerson && !!sellerSpace;
  const buyerResolvedAsSpace = !buyerPerson && !!buyerSpace;

  const personLabel = (p: NonNullable<typeof sellerPerson>) =>
    [p.name, p.surname].filter(Boolean).join(' ') || undefined;

  const sellerDisplayLabel = sellerPerson
    ? personLabel(sellerPerson)
    : sellerResolvedAsSpace
    ? sellerSpace.title
    : undefined;
  const buyerDisplayLabel = buyerPerson
    ? personLabel(buyerPerson)
    : buyerResolvedAsSpace
    ? buyerSpace.title
    : undefined;

  const sellerDisplayAvatarUrl = sellerPerson
    ? sellerPerson.avatarUrl
    : sellerResolvedAsSpace
    ? sellerSpace.logoUrl ?? '/placeholder/space-avatar-image.svg'
    : undefined;
  const buyerDisplayAvatarUrl = buyerPerson
    ? buyerPerson.avatarUrl
    : buyerResolvedAsSpace
    ? buyerSpace.logoUrl ?? '/placeholder/space-avatar-image.svg'
    : undefined;

  const t = useTranslations('AgreementFlow');

  const renderPartyValue = (
    address?: string,
    label?: string,
    avatarUrl?: string,
    avatarAlt?: string,
  ) => {
    if (label) {
      return (
        <span className="flex gap-2 text-2 text-neutral-11">
          <Image
            className="rounded-lg w-[24px] h-[24px]"
            src={avatarUrl ?? '/placeholder/default-profile.svg'}
            width={24}
            height={24}
            alt={avatarAlt ?? t('common.avatarAlt')}
          />
          <span className="text-nowrap">{label}</span>
        </span>
      );
    }
    if (isEvmAddress(address)) {
      return (
        <button
          type="button"
          onClick={() => copyToClipboard(address)}
          className="flex items-center gap-2 text-neutral-11"
          aria-label={t('common.copyWalletAddress')}
        >
          <span>{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
          <CopyIcon className="icon-sm" />
        </button>
      );
    }
    return <span className="text-2">-</span>;
  };

  const renderLegRows = (
    rows: Array<{
      amount: string;
      tokenAddress: string;
    }>,
  ) => {
    if (!rows.length) {
      return <span className="text-2">-</span>;
    }

    return rows.map((leg, index) => {
      const addrKey = leg.tokenAddress.toLowerCase();
      const token = tokens.find(
        (item: ExtendedToken) => item.address.toLowerCase() === addrKey,
      );
      const dbToken = dbTokens?.find(
        (t) => t.address?.toLowerCase() === addrKey,
      );
      // Keep amount as string to preserve precision for large/high-decimal values
      const formattedAmount = (() => {
        const trimmed = leg.amount.trim();
        const asNumber = Number(trimmed);
        // Only format via Number if it's a simple, safe value
        if (Number.isFinite(asNumber) && Math.abs(asNumber) < 1e15) {
          return asNumber.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          });
        }
        // For very large or high-precision amounts, return the string as-is
        return trimmed;
      })();

      const tokenLabel =
        token?.name ?? token?.symbol ?? dbToken?.name ?? dbToken?.symbol;
      const tokenIcon =
        token?.icon ?? dbToken?.iconUrl ?? '/placeholder/token-icon.svg';

      return (
        <div
          key={`${leg.tokenAddress}-${index}`}
          className="flex items-center gap-2 text-2"
        >
          <Image
            src={tokenIcon}
            alt={tokenLabel ?? 'token'}
            width={20}
            height={20}
            className="rounded-full"
          />
          <span className="text-nowrap">
            {formattedAmount}
            {tokenLabel ? ` ${tokenLabel}` : null}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}
        </span>
        {renderPartyValue(
          resolvedSellerAddress,
          sellerDisplayLabel,
          sellerDisplayAvatarUrl,
          sellerResolvedAsSpace
            ? `${sellerSpace?.title ?? 'space'} logo`
            : `${sellerPerson?.nickname ?? 'seller'} avatar`,
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.sellerWillSend')}
        </span>
        <div className="flex flex-col items-end">
          {renderLegRows(sellerLeg)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}
        </span>
        {renderPartyValue(
          resolvedBuyerAddress,
          buyerDisplayLabel,
          buyerDisplayAvatarUrl,
          buyerResolvedAsSpace
            ? `${buyerSpace?.title ?? 'space'} logo`
            : `${buyerPerson?.nickname ?? 'buyer'} avatar`,
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyerWillSend')}
        </span>
        <div className="flex flex-col items-end">{renderLegRows(buyerLeg)}</div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-1 text-neutral-11 shrink-0">
          {tAgreementFlow(
            'plugins.exchangeStakesAndTokens.escrowAccountAddress',
          )}
        </span>
        <div className="flex flex-col items-end min-w-0">
          {escrowContractAddress && isEvmAddress(escrowContractAddress) ? (
            <EscrowAddressCopyRow
              address={escrowContractAddress}
              labelCopied={tCommon('copiedToClipboard')}
              labelCopy={tCommon('copyEscrowAddress')}
            />
          ) : (
            renderPartyValue(escrowContractAddress)
          )}
        </div>
      </div>
    </div>
  );
};
