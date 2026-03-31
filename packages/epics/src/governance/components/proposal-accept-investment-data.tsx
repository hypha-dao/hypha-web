'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { parseHyphaInvestmentFormFromDescription } from '@hypha-platform/core/client';
import { Image, Separator } from '@hypha-platform/ui';
import { EthAddress } from '../../people';
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

function InvestmentSection({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-1 text-neutral-11 leading-snug">{label}</div>
      <div className="flex flex-col items-end gap-2">{children}</div>
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

  return (
    <div className="flex flex-col gap-5">
      <span className="text-neutral-11 text-2 font-medium">{t('title')}</span>

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
