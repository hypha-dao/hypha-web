'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { parseHyphaInvestmentFormFromDescription } from '@hypha-platform/core/client';
import { Image } from '@hypha-platform/ui';
import { EthAddress } from '../../people';
import { usePersonByWeb3Address } from '../hooks';
import { useDbSpaces } from '../../hooks';
import { useTokens } from '../../treasury';
import { Token } from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';

type ExchangeEscrowSummary = {
  partyB?: string;
  tokenA?: string;
  tokenB?: string;
  amountA?: bigint;
  amountB?: bigint;
  sendFundsNow?: boolean;
};

/** Label | value on one row (same pattern as ProposalVotingInfo / ProposalEntryInfo). */
function InvestmentFieldRow({
  label,
  children,
  alignTop,
}: {
  label: ReactNode;
  children: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        alignTop ? 'items-start' : 'items-center'
      }`}
    >
      <div className="min-w-0 w-full text-1 text-neutral-11">{label}</div>
      <div className="flex min-w-0 shrink flex-col items-end justify-center text-1 text-right">
        {children}
      </div>
    </div>
  );
}

function InvestorIdentityRow({ address }: { address: string }) {
  const { spaces } = useDbSpaces({ parentOnly: false });
  const { person } = usePersonByWeb3Address(address as `0x${string}`);

  const space = spaces.find(
    (s) => s.address?.toLowerCase() === address.toLowerCase(),
  );

  if (person) {
    return (
      <span className="flex items-center gap-2 text-1 text-neutral-11">
        <Image
          className="rounded-lg w-[24px] h-[24px]"
          src={person?.avatarUrl ?? '/placeholder/default-profile.svg'}
          width={24}
          height={24}
          alt=""
        />
        <span className="text-nowrap">
          {person?.name} {person?.surname}
        </span>
      </span>
    );
  }

  if (space) {
    return (
      <span className="flex items-center gap-2 text-1 text-neutral-11">
        <Image
          className="rounded-lg w-[24px] h-[24px]"
          src={space?.logoUrl ?? '/placeholder/default-profile.svg'}
          width={24}
          height={24}
          alt=""
        />
        <span className="text-nowrap">{space?.title}</span>
      </span>
    );
  }

  return <EthAddress address={address} />;
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

  const investorAddress =
    parsed?.investorAddress ?? exchangeEscrowData?.partyB ?? '';

  if (!investorAddress && !exchangeEscrowData?.tokenA) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
      <span className="text-neutral-11 text-2 font-medium">{t('title')}</span>

      {investorAddress ? (
        <InvestmentFieldRow label={t('investingMember')}>
          <InvestorIdentityRow address={investorAddress} />
        </InvestmentFieldRow>
      ) : null}

      {parsed?.investorSendLegs?.length ? (
        <InvestmentFieldRow
          alignTop={parsed.investorSendLegs.length > 1}
          label={t('investorWillSend')}
        >
          <div className="flex flex-col items-end gap-2">
            {parsed.investorSendLegs.map((leg, i) => (
              <TokenAmountRow
                key={i}
                spaceSlug={spaceSlug}
                tokenAddress={leg.token}
                amountHuman={leg.amount}
              />
            ))}
          </div>
        </InvestmentFieldRow>
      ) : exchangeEscrowData?.tokenB &&
        exchangeEscrowData.amountB !== undefined ? (
        <InvestmentFieldRow label={t('investorWillSend')}>
          <OnChainTokenRow
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenB}
            rawAmount={exchangeEscrowData.amountB}
          />
        </InvestmentFieldRow>
      ) : null}

      {parsed?.spaceReceiveLegs?.length ? (
        <InvestmentFieldRow
          alignTop={parsed.spaceReceiveLegs.length > 1}
          label={t('investorWillReceive')}
        >
          <div className="flex flex-col items-end gap-2">
            {parsed.spaceReceiveLegs.map((leg, i) => (
              <div key={i} className="flex flex-col items-end gap-0.5">
                <TokenAmountRow
                  spaceSlug={spaceSlug}
                  tokenAddress={leg.token}
                  amountHuman={leg.amount}
                />
                <span className="max-w-[min(100%,280px)] text-1 text-neutral-11">
                  {leg.source === 'treasury'
                    ? t('sourceTreasury')
                    : leg.source === 'mint'
                    ? t('sourceMint')
                    : t('fundingTreasuryThenMint')}
                </span>
              </div>
            ))}
          </div>
        </InvestmentFieldRow>
      ) : parsed?.investorSendLegs?.length ? (
        <InvestmentFieldRow
          alignTop={parsed.investorSendLegs.length > 1}
          label={t('investorWillReceive')}
        >
          <div className="flex flex-col items-end gap-2">
            {parsed.investorSendLegs.map((leg, i) => (
              <div key={i} className="flex flex-col items-end gap-0.5">
                <TokenAmountRow
                  spaceSlug={spaceSlug}
                  tokenAddress={leg.token}
                  amountHuman={leg.amount}
                />
                <span className="max-w-[min(100%,280px)] text-1 text-neutral-11">
                  {t('fundingTreasuryThenMint')}
                </span>
              </div>
            ))}
          </div>
        </InvestmentFieldRow>
      ) : exchangeEscrowData?.tokenA &&
        exchangeEscrowData.amountA !== undefined ? (
        <InvestmentFieldRow label={t('investorWillReceive')}>
          <OnChainTokenRow
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenA}
            rawAmount={exchangeEscrowData.amountA}
          />
        </InvestmentFieldRow>
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
