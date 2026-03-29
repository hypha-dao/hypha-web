'use client';

import { useTranslations } from 'next-intl';
import { usePersonByWeb3Address } from '../hooks';
import { Image } from '@hypha-platform/ui';
import { useTokens, ExtendedToken } from '../../treasury';
import { CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import { useSpaceBySlug, Space } from '@hypha-platform/core/client';
import { useDbSpaces } from '../../hooks';

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
}

export const ProposalExchangeStakesAndTokensData = ({
  spaceSlug,
  sellerAddress,
  buyerAddress,
  fallbackSellerAddress,
  fallbackBuyerAddress,
  sellerLeg,
  buyerLeg,
}: ProposalExchangeStakesAndTokensDataProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { tokens } = useTokens({ spaceSlug });
  const { space } = useSpaceBySlug(spaceSlug);
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
  const sellerMemberInSpace = space?.members?.find(
    (member) =>
      member.address?.toLowerCase() === resolvedSellerAddress?.toLowerCase(),
  );
  const buyerMemberInSpace = space?.members?.find(
    (member) =>
      member.address?.toLowerCase() === resolvedBuyerAddress?.toLowerCase(),
  );
  const displaySellerPerson = sellerPerson ?? sellerMemberInSpace;
  const displayBuyerPerson = buyerPerson ?? buyerMemberInSpace;

  const resolveSpaceForWallet = (addr?: string): Space | undefined => {
    if (!addr) return undefined;
    const lower = addr.toLowerCase();
    if (space?.address && space.address.toLowerCase() === lower) {
      return space;
    }
    return dbSpaces.find((s) => s.address?.toLowerCase() === lower);
  };

  /** Space executor / contract address: show space title + logo when no person record */
  const sellerSpaceMatch = resolveSpaceForWallet(resolvedSellerAddress);
  const buyerSpaceMatch = resolveSpaceForWallet(resolvedBuyerAddress);
  const sellerResolvedAsSpace = !displaySellerPerson && !!sellerSpaceMatch;
  const buyerResolvedAsSpace = !displayBuyerPerson && !!buyerSpaceMatch;

  const personLabel = (p: NonNullable<typeof displaySellerPerson>) =>
    [p.name, p.surname].filter(Boolean).join(' ') || undefined;

  const sellerDisplayLabel = displaySellerPerson
    ? personLabel(displaySellerPerson)
    : sellerResolvedAsSpace
    ? sellerSpaceMatch.title
    : undefined;
  const buyerDisplayLabel = displayBuyerPerson
    ? personLabel(displayBuyerPerson)
    : buyerResolvedAsSpace
    ? buyerSpaceMatch.title
    : undefined;

  const sellerDisplayAvatarUrl = displaySellerPerson
    ? displaySellerPerson.avatarUrl
    : sellerResolvedAsSpace
    ? sellerSpaceMatch.logoUrl ?? '/placeholder/space-avatar-image.svg'
    : undefined;
  const buyerDisplayAvatarUrl = displayBuyerPerson
    ? displayBuyerPerson.avatarUrl
    : buyerResolvedAsSpace
    ? buyerSpaceMatch.logoUrl ?? '/placeholder/space-avatar-image.svg'
    : undefined;

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
            alt={avatarAlt ?? 'avatar'}
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
          aria-label="Copy wallet address"
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
      const token = tokens.find(
        (item: ExtendedToken) =>
          item.address.toLowerCase() === leg.tokenAddress.toLowerCase(),
      );
      const parsedAmount = Number(leg.amount);
      const formattedAmount = Number.isFinite(parsedAmount)
        ? parsedAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })
        : leg.amount;

      return (
        <div
          key={`${leg.tokenAddress}-${index}`}
          className="flex items-center gap-2 text-2"
        >
          <Image
            src={token?.icon ?? '/placeholder/token-icon.svg'}
            alt={token?.symbol ?? token?.name ?? 'token'}
            width={20}
            height={20}
            className="rounded-full"
          />
          <span className="text-nowrap">
            {formattedAmount}{' '}
            {token?.name ?? token?.symbol ?? leg.tokenAddress.slice(0, 8)}
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
            ? `${sellerSpaceMatch?.title ?? 'space'} logo`
            : `${displaySellerPerson?.nickname ?? 'seller'} avatar`,
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
            ? `${buyerSpaceMatch?.title ?? 'space'} logo`
            : `${displayBuyerPerson?.nickname ?? 'buyer'} avatar`,
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {tAgreementFlow('plugins.exchangeStakesAndTokens.buyerWillSend')}
        </span>
        <div className="flex flex-col items-end">{renderLegRows(buyerLeg)}</div>
      </div>
    </div>
  );
};
