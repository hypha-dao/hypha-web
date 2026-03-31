'use client';

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

function InvestorIdentityRow({ address }: { address: string }) {
  const { spaces } = useDbSpaces({ parentOnly: false });
  const { person } = usePersonByWeb3Address(address as `0x${string}`);

  const space = spaces.find(
    (s) => s.address?.toLowerCase() === address.toLowerCase(),
  );

  if (person) {
    return (
      <span className="flex gap-2 text-2 text-neutral-11 items-center">
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
      <span className="flex gap-2 text-2 text-neutral-11 items-center">
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
      <div className="text-2 text-neutral-9 pl-2">
        {amountHuman} · <EthAddress address={tokenAddress} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 pl-2">
      <Image
        src={token.icon}
        alt={token.symbol}
        width={24}
        height={24}
        className="rounded-full"
      />
      <span className="text-2 text-neutral-9">
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
    <div className="flex flex-col gap-4">
      <span className="text-neutral-11 text-2 font-medium">{t('title')}</span>

      {investorAddress ? (
        <div className="flex flex-col gap-1">
          <span className="text-neutral-11 text-1">{t('investingMember')}</span>
          <InvestorIdentityRow address={investorAddress} />
        </div>
      ) : null}

      {parsed?.investorSendLegs?.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-neutral-11 text-1">
            {t('investorWillSend')}
          </span>
          {parsed.investorSendLegs.map((leg, i) => (
            <TokenAmountRow
              key={i}
              spaceSlug={spaceSlug}
              tokenAddress={leg.token}
              amountHuman={leg.amount}
            />
          ))}
        </div>
      ) : exchangeEscrowData?.tokenB &&
        exchangeEscrowData.amountB !== undefined ? (
        <div className="flex flex-col gap-1">
          <span className="text-neutral-11 text-1">
            {t('investorWillSend')}
          </span>
          <OnChainTokenRow
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenB}
            rawAmount={exchangeEscrowData.amountB}
          />
        </div>
      ) : null}

      {parsed?.spaceReceiveLegs?.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-neutral-11 text-1">
            {t('investorWillReceive')}
          </span>
          {parsed.spaceReceiveLegs.map((leg, i) => (
            <div key={i} className="flex flex-col gap-1 pl-2">
              <TokenAmountRow
                spaceSlug={spaceSlug}
                tokenAddress={leg.token}
                amountHuman={leg.amount}
              />
              <span className="text-1 text-neutral-11">
                {leg.source === 'treasury'
                  ? t('sourceTreasury')
                  : leg.source === 'mint'
                  ? t('sourceMint')
                  : t('fundingTreasuryThenMint')}
              </span>
            </div>
          ))}
        </div>
      ) : parsed?.investorSendLegs?.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-neutral-11 text-1">
            {t('investorWillReceive')}
          </span>
          {parsed.investorSendLegs.map((leg, i) => (
            <div key={i} className="flex flex-col gap-1 pl-2">
              <TokenAmountRow
                spaceSlug={spaceSlug}
                tokenAddress={leg.token}
                amountHuman={leg.amount}
              />
              <span className="text-1 text-neutral-11">
                {t('fundingTreasuryThenMint')}
              </span>
            </div>
          ))}
        </div>
      ) : exchangeEscrowData?.tokenA &&
        exchangeEscrowData.amountA !== undefined ? (
        <div className="flex flex-col gap-1">
          <span className="text-neutral-11 text-1">
            {t('investorWillReceive')}
          </span>
          <OnChainTokenRow
            spaceSlug={spaceSlug}
            tokenAddress={exchangeEscrowData.tokenA}
            rawAmount={exchangeEscrowData.amountA}
          />
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
