import {
  getPriceCurrencyCode,
  isTokenUpdateData,
  useJwt,
  useUpdateTokenByAddress,
  type Space,
  type TokenType,
  type TransferWhitelistFormValue,
} from '@hypha-platform/core/client';
import { getAddress } from 'viem';
import { Separator } from '@hypha-platform/ui';
import {
  formatCurrencyValue,
  formatDecayInterval,
} from '@hypha-platform/ui-utils';
import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { normalizeMaxSupplyHuman } from '../../treasury/utils/normalize-max-supply-human';
import { WhitelistAddressItem } from './proposal-token-items';

export interface ProposalUpdateTokenProps {
  address: `0x${string}`;
  /** From space token list when known; pending update JSON otherwise supplies type */
  tokenType?: TokenType;
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
  /** From proposal tx `batchSet*` (member wallets) */
  initialTransferWhitelist?: `0x${string}`[];
  initialReceiveWhitelist?: `0x${string}`[];
  /** From `batchAdd*WhitelistSpaces` calldata */
  initialTransferWhitelistSpaceIds?: number[];
  initialReceiveWhitelistSpaceIds?: number[];
  /** DB spaces (map web3 id → contract address for whitelist display) */
  spacesForWhitelistDisplay?: Space[];
  archiveToken?: boolean;
  /** From proposal txs / chain; when set with maxSupply 0, shows cap type in UI */
  fixedMaxSupply?: boolean;
}

interface TokenUpdateDataInterface {
  iconUrl?: string;
  type?: TokenType;
  name?: string;
  symbol?: string;
  maxSupply?: number;
  maxSupplyTypeValue?: 'immutable' | 'updatable';
  transferWhitelist?: TransferWhitelistFormValue;
}

export const ProposalUpdateToken = ({
  address,
  tokenType: tokenTypeProp,
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
  initialTransferWhitelist: initialTransferFromTx,
  initialReceiveWhitelist: initialReceiveFromTx,
  initialTransferWhitelistSpaceIds,
  initialReceiveWhitelistSpaceIds,
  spacesForWhitelistDisplay = [],
  archiveToken,
  fixedMaxSupply: fixedMaxSupplyProp,
}: ProposalUpdateTokenProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { jwt: authToken } = useJwt();
  const { tokenUpdate, isLoading: isTokenUpdateLoading } =
    useUpdateTokenByAddress({
      address,
      authToken: authToken ?? undefined,
    });
  const pendingData: TokenUpdateDataInterface | undefined =
    tokenUpdate?.data && isTokenUpdateData(tokenUpdate.data)
      ? (tokenUpdate.data as TokenUpdateDataInterface)
      : undefined;
  const tokenIcon = React.useMemo(() => {
    return isTokenUpdateLoading ? undefined : pendingData?.iconUrl;
  }, [isTokenUpdateLoading, pendingData?.iconUrl]);

  const resolvedTokenType = tokenTypeProp ?? pendingData?.type;
  const showDecaySettings =
    resolvedTokenType === 'voice' &&
    decayPercentage !== undefined &&
    decayInterval !== undefined;

  const transferWhitelistFromPending = pendingData?.transferWhitelist;
  const fromEntriesPending = transferWhitelistFromPending?.from?.filter(
    (e) => e?.address,
  );
  const toEntriesPending = transferWhitelistFromPending?.to?.filter(
    (e) => e?.address,
  );

  const uniqueSorted = (addrs: `0x${string}`[]) => {
    const seen = new Set<string>();
    const out: `0x${string}`[] = [];
    for (const a of addrs) {
      const k = a.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a);
      }
    }
    return out;
  };

  const addressesFromSpaceIds = React.useCallback(
    (ids: number[] | undefined) => {
      if (!ids?.length) {
        return [] as `0x${string}`[];
      }
      const want = new Set(ids);
      const addrs: `0x${string}`[] = [];
      for (const s of spacesForWhitelistDisplay) {
        if (
          s.web3SpaceId == null ||
          !want.has(Number(s.web3SpaceId)) ||
          !s.address?.startsWith('0x')
        ) {
          continue;
        }
        try {
          addrs.push(getAddress(s.address as `0x${string}`));
        } catch {
          // skip
        }
      }
      return addrs;
    },
    [spacesForWhitelistDisplay],
  );

  const fromAddressesForDisplay = React.useMemo(() => {
    if (fromEntriesPending?.length) {
      return uniqueSorted(
        fromEntriesPending.map((e) => e.address as `0x${string}`),
      );
    }
    return uniqueSorted([
      ...(initialTransferFromTx?.filter(Boolean) ?? []),
      ...addressesFromSpaceIds(initialTransferWhitelistSpaceIds),
    ]);
  }, [
    fromEntriesPending,
    initialTransferFromTx,
    initialTransferWhitelistSpaceIds,
    addressesFromSpaceIds,
  ]);

  const toAddressesForDisplay = React.useMemo(() => {
    if (toEntriesPending?.length) {
      return uniqueSorted(
        toEntriesPending.map((e) => e.address as `0x${string}`),
      );
    }
    return uniqueSorted([
      ...(initialReceiveFromTx?.filter(Boolean) ?? []),
      ...addressesFromSpaceIds(initialReceiveWhitelistSpaceIds),
    ]);
  }, [
    toEntriesPending,
    initialReceiveFromTx,
    initialReceiveWhitelistSpaceIds,
    addressesFromSpaceIds,
  ]);

  const showTransferWhitelistDetails =
    fromAddressesForDisplay.length > 0 || toAddressesForDisplay.length > 0;
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

  const resolvedName = name ?? pendingData?.name;
  const resolvedSymbol = symbol ?? pendingData?.symbol;
  const resolvedMaxHuman = React.useMemo(() => {
    if (maxSupplyHuman !== undefined) {
      return maxSupplyHuman;
    }
    if (pendingData?.maxSupply !== undefined) {
      return normalizeMaxSupplyHuman(pendingData.maxSupply);
    }
    return undefined;
  }, [maxSupplyHuman, pendingData?.maxSupply]);

  const showTokenPrice =
    priceWithCurrency !== undefined &&
    priceWithCurrency.tokenPrice !== undefined &&
    priceCurrencyFeed !== undefined &&
    tokenPrice !== undefined;

  const maxSupplyTypeBracket = React.useMemo(() => {
    const fromPending = pendingData?.maxSupplyTypeValue;
    if (fromPending === 'immutable') {
      return tAgreementFlow(
        'plugins.issueNewToken.general.maxSupplyTypeOptions.immutable',
      );
    }
    if (fromPending === 'updatable') {
      return tAgreementFlow(
        'plugins.issueNewToken.general.maxSupplyTypeOptions.updatable',
      );
    }
    if (fixedMaxSupplyProp === true) {
      return tAgreementFlow(
        'plugins.issueNewToken.general.maxSupplyTypeOptions.immutable',
      );
    }
    if (fixedMaxSupplyProp === false) {
      return tAgreementFlow(
        'plugins.issueNewToken.general.maxSupplyTypeOptions.updatable',
      );
    }
    return null;
  }, [pendingData?.maxSupplyTypeValue, fixedMaxSupplyProp, tAgreementFlow]);

  const maxSupplyDisplay =
    resolvedMaxHuman === undefined ? (
      <>
        {tProposalDetails('labels.unlimitedSupply')}
        {maxSupplyTypeBracket ? (
          <span className="text-neutral-11"> ({maxSupplyTypeBracket})</span>
        ) : null}
      </>
    ) : resolvedMaxHuman === 0 ? (
      <>
        {tProposalDetails('labels.unlimitedSupply')}
        {maxSupplyTypeBracket ? (
          <span className="text-neutral-11"> ({maxSupplyTypeBracket})</span>
        ) : null}
      </>
    ) : (
      <>
        {formatCurrencyValue(resolvedMaxHuman)}
        {maxSupplyTypeBracket ? (
          <span className="text-neutral-11"> ({maxSupplyTypeBracket})</span>
        ) : null}
      </>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenName')}
          </div>
          <div className="text-1 text-nowrap">
            {resolvedName !== undefined && resolvedName !== ''
              ? resolvedName
              : tProposalDetails('labels.unknown')}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.tokenSymbol')}
          </div>
          <div className="text-1 text-nowrap">
            {resolvedSymbol !== undefined && resolvedSymbol !== ''
              ? resolvedSymbol
              : tProposalDetails('labels.unknown')}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.maxSupply')}
          </div>
          <div className="text-1">{maxSupplyDisplay}</div>
        </div>
        {showTokenPrice && tokenPrice !== undefined && priceCurrencyFeed && (
          <div className="flex justify-between items-center text-nowrap">
            <div className="text-1 text-neutral-11 w-full">
              {tProposalDetails('labels.tokenPrice')}
            </div>
            <div className="text-1">
              {formatCurrencyValue(tokenPrice)} {priceCurrencyFeed}
            </div>
          </div>
        )}
      </div>

      <Separator />

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
      {showDecaySettings && (
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
      {showTransferWhitelistDetails && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="text-1 text-neutral-11 font-medium">
              {tProposalDetails('sections.transferWhitelists')}
            </div>
            {fromAddressesForDisplay.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-1 text-neutral-11 font-bold">
                  {tProposalDetails('sections.fromWhitelist')}
                </div>
                <div className="flex flex-col gap-4">
                  {fromAddressesForDisplay.map((addr, idx) => (
                    <WhitelistAddressItem
                      key={`from-${idx}-${addr}`}
                      address={addr}
                    />
                  ))}
                </div>
              </div>
            )}
            {toAddressesForDisplay.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-1 text-neutral-11 font-bold">
                  {tProposalDetails('sections.toWhitelist')}
                </div>
                <div className="flex flex-col gap-4">
                  {toAddressesForDisplay.map((addr, idx) => (
                    <WhitelistAddressItem
                      key={`to-${idx}-${addr}`}
                      address={addr}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
