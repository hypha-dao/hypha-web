'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  getEscrowImplementationAddress,
  parseHyphaInvestmentFormFromDescription,
} from '@hypha-platform/core/client';
import { Image, Separator } from '@hypha-platform/ui';
import { EthAddress } from '../../people';
import { useTokens } from '../../treasury';
import { Token } from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { usePersonByWeb3Address } from '../hooks';
import { useDbSpaces } from '../../hooks';

type ExchangeEscrowSummary = {
  partyA?: string;
  partyB?: string;
  tokenA?: string;
  tokenB?: string;
  amountA?: bigint;
  amountB?: bigint;
  sendFundsNow?: boolean;
};

const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as `0x${string}`;

const isEvmAddress = (value: string | undefined | null): value is string =>
  !!value && /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * Resolves the investor (partyB) address from either the embedded marker
 * (preferred — survives even after partial markdown stripping) or the
 * on-chain escrow summary as a fallback.
 */
function InvestorRow({ investorAddress }: { investorAddress: string }) {
  // Skip the lookup for the zero address (used as a sentinel when the
  // upstream resolver hasn't decided yet) — it would otherwise resolve to
  // the burn-address person record on some seeds.
  const lookupAddress = isEvmAddress(investorAddress)
    ? (investorAddress as `0x${string}`)
    : ZERO_ADDRESS;
  const { person } = usePersonByWeb3Address(lookupAddress);
  const { spaces: dbSpaces } = useDbSpaces({ parentOnly: false });
  const space = dbSpaces.find(
    (s) =>
      isEvmAddress(investorAddress) &&
      s.address?.toLowerCase() === investorAddress.toLowerCase(),
  );

  const personLabel = person
    ? [person.name, person.surname].filter(Boolean).join(' ')
    : '';
  const label = personLabel || space?.title || '';
  const avatarUrl =
    person?.avatarUrl || space?.logoUrl || '/placeholder/default-profile.svg';

  if (!isEvmAddress(investorAddress)) {
    return <span className="text-1 text-neutral-9">-</span>;
  }

  if (label) {
    return (
      <div className="flex items-center justify-end gap-2 text-1 text-neutral-9">
        <Image
          src={avatarUrl}
          alt={label}
          width={24}
          height={24}
          className="rounded-full w-6 h-6 object-cover"
        />
        <span className="text-nowrap">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end">
      <EthAddress address={investorAddress} />
    </div>
  );
}

function InvestmentSection({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-row items-start gap-4 w-full">
      <div className="text-1 text-neutral-11 leading-snug shrink-0 max-w-[12rem]">
        {label}
      </div>
      <div className="flex flex-col items-end gap-2 grow min-w-0">
        {children}
      </div>
    </div>
  );
}

function TokenAmountRow({
  spaceSlug,
  tokenAddress,
  amountHuman,
}: {
  spaceSlug: string;
  tokenAddress: string;
  amountHuman: string;
}) {
  const { tokens } = useTokens({ spaceSlug });
  const token = tokens.find(
    (tok: Token) => tok.address.toLowerCase() === tokenAddress.toLowerCase(),
  );

  if (!token) {
    return (
      <div className="flex items-center justify-end gap-2 text-1 text-neutral-9">
        <span>
          {amountHuman} · <EthAddress address={tokenAddress} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Image
        src={token.icon}
        alt={token.symbol}
        width={24}
        height={24}
        className="rounded-full"
      />
      <span className="text-nowrap text-1 text-neutral-9">
        {formatCurrencyValue(Number(amountHuman))} {token.symbol}
      </span>
    </div>
  );
}

export function ProposalAcceptInvestmentData({
  descriptionMarkdown,
  spaceSlug,
  exchangeEscrowData,
}: {
  descriptionMarkdown?: string;
  spaceSlug: string;
  exchangeEscrowData?: ExchangeEscrowSummary;
}) {
  const t = useTranslations('ProposalDetails.investment');
  const parsed = parseHyphaInvestmentFormFromDescription(descriptionMarkdown);

  const sendLabel = (
    <>
      <span className="block">{t('investorWillSendLine1')}</span>
      <span className="block">{t('investorWillSendLine2')}</span>
    </>
  );
  const receiveLabel = (
    <>
      <span className="block">{t('investorWillReceiveLine1')}</span>
      <span className="block">{t('investorWillReceiveLine2')}</span>
    </>
  );

  const sendFromMarker = parsed?.investorSendLegs?.length
    ? parsed.investorSendLegs.map((leg, i) => (
        <TokenAmountRow
          key={i}
          spaceSlug={spaceSlug}
          tokenAddress={leg.token}
          amountHuman={leg.amount}
        />
      ))
    : exchangeEscrowData?.tokenB && exchangeEscrowData.amountB !== undefined
      ? [
          <OnChainTokenRow
            key="onchain-send"
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenB}
            rawAmount={exchangeEscrowData.amountB}
          />,
        ]
      : null;

  const receiveFromMarker = parsed?.spaceReceiveLegs?.length
    ? parsed.spaceReceiveLegs.map((leg, i) => (
        <TokenAmountRow
          key={i}
          spaceSlug={spaceSlug}
          tokenAddress={leg.token}
          amountHuman={leg.amount}
        />
      ))
    : exchangeEscrowData?.tokenA && exchangeEscrowData.amountA !== undefined
      ? [
          <OnChainTokenRow
            key="onchain-recv"
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenA}
            rawAmount={exchangeEscrowData.amountA}
          />,
        ]
      : null;

  if (!sendFromMarker && !receiveFromMarker) {
    return null;
  }

  const showBothSections = Boolean(sendFromMarker && receiveFromMarker);
  const escrowAddr = getEscrowImplementationAddress();
  // Prefer the marker payload (set when the proposal is created so it
  // survives even if the on-chain escrow record is missing); fall back to
  // partyB from the indexed escrow snapshot.
  const investorAddress = parsed?.investorAddress ?? exchangeEscrowData?.partyB;

  return (
    <div className="flex flex-col gap-5">
      <span className="text-neutral-11 text-2 font-medium">{t('title')}</span>

      {investorAddress ? (
        <InvestmentSection label={t('investor')}>
          <InvestorRow investorAddress={investorAddress} />
        </InvestmentSection>
      ) : null}

      {sendFromMarker ? (
        <InvestmentSection label={sendLabel}>
          {sendFromMarker}
        </InvestmentSection>
      ) : null}

      {showBothSections ? <Separator /> : null}

      {receiveFromMarker ? (
        <InvestmentSection label={receiveLabel}>
          {receiveFromMarker}
        </InvestmentSection>
      ) : null}

      {escrowAddr ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full gap-x-4">
          <span className="text-1 text-neutral-11 shrink-0">
            {t('escrowAccountAddress')}
          </span>
          <div className="min-w-0 sm:max-w-[min(100%,20rem)] sm:ml-auto">
            <EthAddress address={escrowAddr} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OnChainTokenRow({
  spaceSlug,
  tokenAddress,
  rawAmount,
}: {
  spaceSlug: string;
  tokenAddress: string;
  rawAmount: bigint;
}) {
  const { data: decimalsData } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  const decimals =
    decimalsData && typeof decimalsData === 'number' ? decimalsData : 18;
  const human = Number(rawAmount) / 10 ** decimals;
  const formatted = human.toFixed(Math.min(decimals, 6));

  return (
    <TokenAmountRow
      spaceSlug={spaceSlug}
      tokenAddress={tokenAddress}
      amountHuman={formatted}
    />
  );
}
