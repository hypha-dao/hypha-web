import {
  getPriceCurrencyCode,
  isTokenUpdateData,
  normalizeWhitelistAddresses,
  useJwt,
  useTokenUpdateByDocumentId,
  useUpdateTokenByAddress,
  type DbToken,
  type Space,
  type TokenType,
  type TransferWhitelistFormValue,
} from '@hypha-platform/core/client';
import { formatUnits, getAddress } from 'viem';
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
import { buildWhitelistDiffRows } from '../utils/whitelist-proposal-diff';
import { useDbSpaces } from '../../hooks';
import { Badge } from '@hypha-platform/ui';

function buildSpaceScopeMapFromEntries(
  entries:
    | Array<{
        address?: string;
        type?: 'member' | 'space';
        includeSpaceMembers?: boolean;
      }>
    | undefined,
): Map<string, 'members' | 'only'> {
  const m = new Map<string, 'members' | 'only'>();
  if (!entries?.length) {
    return m;
  }
  for (const e of entries) {
    if (e?.type !== 'space' || !e?.address?.startsWith('0x')) {
      continue;
    }
    try {
      const k = getAddress(e.address as `0x${string}`).toLowerCase();
      m.set(k, e.includeSpaceMembers === false ? 'only' : 'members');
    } catch {
      // skip invalid
    }
  }
  return m;
}

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
  /** Space tokens from DB — fallback when RPC decode or pending row lacks name/symbol/supply */
  dbTokens?: DbToken[];
  archiveToken?: boolean;
  /** From proposal txs / chain; when set with maxSupply 0, shows cap type in UI */
  fixedMaxSupply?: boolean;
  /** Prefer pending `token_updates` row for this agreement (correct when multiple spaces share an address). */
  documentId?: number;
  /** From `setDefaultCreditLimit` calldata (raw bigint, scaled by 1e18). */
  defaultCreditLimit?: bigint;
  /** From `batchAddCreditWhitelistSpaces` calldata. */
  addCreditWhitelistSpaceIds?: number[];
  /** From `batchRemoveCreditWhitelistSpaces` calldata. */
  removeCreditWhitelistSpaceIds?: number[];
}

interface TokenUpdateDataInterface {
  iconUrl?: string;
  type?: TokenType;
  name?: string;
  symbol?: string;
  maxSupply?: number;
  maxSupplyTypeValue?: 'immutable' | 'updatable';
  transferable?: boolean;
  enableAdvancedTransferControls?: boolean;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  transferWhitelist?: TransferWhitelistFormValue;
  whitelistSnapshotBeforeProposal?: {
    transferAddresses: `0x${string}`[];
    receiveAddresses: `0x${string}`[];
  };
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
  dbTokens,
  archiveToken,
  fixedMaxSupply: fixedMaxSupplyProp,
  documentId,
  defaultCreditLimit,
  addCreditWhitelistSpaceIds,
  removeCreditWhitelistSpaceIds,
}: ProposalUpdateTokenProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { jwt: authToken } = useJwt();
  const { tokenUpdate: tokenUpdateByDoc, isLoading: isLoadingDoc } =
    useTokenUpdateByDocumentId({
      documentId: documentId ?? undefined,
      authToken: authToken ?? undefined,
    });
  const { tokenUpdate: tokenUpdateByAddr, isLoading: isLoadingAddr } =
    useUpdateTokenByAddress({
      address: documentId ? undefined : address,
      authToken: authToken ?? undefined,
    });
  const tokenUpdate = tokenUpdateByDoc ?? tokenUpdateByAddr;
  const isTokenUpdateLoading =
    documentId != null ? isLoadingDoc : isLoadingAddr;
  const pendingData: TokenUpdateDataInterface | undefined =
    tokenUpdate?.data && isTokenUpdateData(tokenUpdate.data)
      ? (tokenUpdate.data as TokenUpdateDataInterface)
      : undefined;

  const dbTokenMatch = React.useMemo(() => {
    if (!dbTokens?.length || !address) {
      return undefined;
    }
    const want = address.toLowerCase();
    return dbTokens.find(
      (t) => typeof t.address === 'string' && t.address.toLowerCase() === want,
    );
  }, [dbTokens, address]);

  const tokenIcon = React.useMemo(() => {
    if (isTokenUpdateLoading) {
      return undefined;
    }
    return pendingData?.iconUrl ?? dbTokenMatch?.iconUrl;
  }, [isTokenUpdateLoading, pendingData?.iconUrl, dbTokenMatch?.iconUrl]);

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

  const hasWhitelistSnapshot =
    pendingData?.whitelistSnapshotBeforeProposal !== undefined;

  /**
   * Proposed whitelist addresses for diff vs `whitelistSnapshotBeforeProposal`.
   * Must match how the snapshot relates to the saved form: use each row's
   * `address` (space contract or member wallet) + `normalizeWhitelistAddresses`,
   * same as at submit. Do not rebuild only via `splitWhitelistFormToTargets` +
   * `addressesFromSpaceIds` — that drops space contract addresses when web3 id
   * resolution fails, falsely marking spaces as removed (−).
   */
  const targetFromForDiff = React.useMemo(() => {
    if (!fromEntriesPending?.length) {
      return [] as `0x${string}`[];
    }
    return normalizeWhitelistAddresses(
      fromEntriesPending.map((e) => e.address as `0x${string}`),
    );
  }, [fromEntriesPending]);

  const targetToForDiff = React.useMemo(() => {
    if (!toEntriesPending?.length) {
      return [] as `0x${string}`[];
    }
    return normalizeWhitelistAddresses(
      toEntriesPending.map((e) => e.address as `0x${string}`),
    );
  }, [toEntriesPending]);

  const fromWhitelistDiffRows = React.useMemo(() => {
    if (
      !hasWhitelistSnapshot ||
      !pendingData?.whitelistSnapshotBeforeProposal
    ) {
      return null;
    }
    return buildWhitelistDiffRows(
      pendingData.whitelistSnapshotBeforeProposal.transferAddresses,
      targetFromForDiff,
    );
  }, [
    hasWhitelistSnapshot,
    pendingData?.whitelistSnapshotBeforeProposal,
    targetFromForDiff,
  ]);

  const toWhitelistDiffRows = React.useMemo(() => {
    if (
      !hasWhitelistSnapshot ||
      !pendingData?.whitelistSnapshotBeforeProposal
    ) {
      return null;
    }
    return buildWhitelistDiffRows(
      pendingData.whitelistSnapshotBeforeProposal.receiveAddresses,
      targetToForDiff,
    );
  }, [
    hasWhitelistSnapshot,
    pendingData?.whitelistSnapshotBeforeProposal,
    targetToForDiff,
  ]);

  const fromWhitelistRender = React.useMemo(() => {
    if (fromWhitelistDiffRows !== null) {
      return { showDiff: true, rows: fromWhitelistDiffRows };
    }
    return {
      showDiff: false,
      rows: fromAddressesForDisplay.map((addr) => ({
        address: addr,
        status: 'unchanged' as const,
      })),
    };
  }, [fromWhitelistDiffRows, fromAddressesForDisplay]);

  const toWhitelistRender = React.useMemo(() => {
    if (toWhitelistDiffRows !== null) {
      return { showDiff: true, rows: toWhitelistDiffRows };
    }
    return {
      showDiff: false,
      rows: toAddressesForDisplay.map((addr) => ({
        address: addr,
        status: 'unchanged' as const,
      })),
    };
  }, [toWhitelistDiffRows, toAddressesForDisplay]);

  const spaceScopeFromPending = React.useMemo(
    () => buildSpaceScopeMapFromEntries(fromEntriesPending),
    [fromEntriesPending],
  );
  const spaceScopeToPending = React.useMemo(
    () => buildSpaceScopeMapFromEntries(toEntriesPending),
    [toEntriesPending],
  );

  const showTransferWhitelistDetails =
    fromWhitelistRender.rows.length > 0 || toWhitelistRender.rows.length > 0;
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

  const resolvedName = name ?? pendingData?.name ?? dbTokenMatch?.name;
  const resolvedSymbol = symbol ?? pendingData?.symbol ?? dbTokenMatch?.symbol;
  const resolvedTransferable = pendingData?.transferable ?? transferable;
  const resolvedUseTransferWhitelist =
    pendingData?.useTransferWhitelist ?? useTransferWhitelist;
  const resolvedUseReceiveWhitelist =
    pendingData?.useReceiveWhitelist ?? useReceiveWhitelist;
  const resolvedMaxHuman = React.useMemo(() => {
    if (maxSupplyHuman !== undefined) {
      return maxSupplyHuman;
    }
    if (pendingData?.maxSupply !== undefined) {
      return normalizeMaxSupplyHuman(pendingData.maxSupply);
    }
    if (dbTokenMatch?.maxSupply !== undefined) {
      return normalizeMaxSupplyHuman(dbTokenMatch.maxSupply);
    }
    return undefined;
  }, [maxSupplyHuman, pendingData?.maxSupply, dbTokenMatch?.maxSupply]);

  const showTokenPrice =
    priceWithCurrency !== undefined &&
    priceWithCurrency.tokenPrice !== undefined &&
    priceCurrencyFeed !== undefined &&
    tokenPrice !== undefined;

  const maxSupplyTypeBracket = React.useMemo(() => {
    const fromPending = pendingData?.maxSupplyTypeValue;
    if (fromPending === 'immutable') {
      return tAgreementFlow(
        'plugins.issueNewToken.supply.maxSupplyTypeOptions.immutable',
      );
    }
    if (fromPending === 'updatable') {
      return tAgreementFlow(
        'plugins.issueNewToken.supply.maxSupplyTypeOptions.updatable',
      );
    }
    if (fixedMaxSupplyProp === true) {
      return tAgreementFlow(
        'plugins.issueNewToken.supply.maxSupplyTypeOptions.immutable',
      );
    }
    if (fixedMaxSupplyProp === false) {
      return tAgreementFlow(
        'plugins.issueNewToken.supply.maxSupplyTypeOptions.updatable',
      );
    }
    return null;
  }, [pendingData?.maxSupplyTypeValue, fixedMaxSupplyProp, tAgreementFlow]);

  const maxSupplyMainLine =
    resolvedMaxHuman === undefined || resolvedMaxHuman === 0
      ? tProposalDetails('labels.unlimitedSupply')
      : formatCurrencyValue(resolvedMaxHuman);

  const maxSupplyDisplay = (
    <div className="flex flex-col items-end gap-0.5 text-right">
      <span>{maxSupplyMainLine}</span>
      {maxSupplyTypeBracket ? (
        <span className="text-xs text-neutral-11 leading-tight">
          ({maxSupplyTypeBracket})
        </span>
      ) : null}
    </div>
  );

  /**
   * Mutual credit summary — tx may carry any of: setDefaultCreditLimit,
   * batchAddCreditWhitelistSpaces, batchRemoveCreditWhitelistSpaces.
   * Disable is signaled by `setDefaultCreditLimit(0)`.
   */
  const creditLimitHuman = React.useMemo(() => {
    if (defaultCreditLimit === undefined) {
      return undefined;
    }
    return Number(formatUnits(defaultCreditLimit, 18));
  }, [defaultCreditLimit]);
  const creditDisabled =
    creditLimitHuman !== undefined && creditLimitHuman === 0;
  const showCreditSection =
    defaultCreditLimit !== undefined ||
    Boolean(addCreditWhitelistSpaceIds?.length) ||
    Boolean(removeCreditWhitelistSpaceIds?.length);
  const { spaces: dbSpacesForCredit } = useDbSpaces({ parentOnly: false });
  const resolveSpacesByIds = React.useCallback(
    (ids: number[] | undefined) => {
      if (!ids?.length) {
        return [];
      }
      return ids
        .map((id) =>
          dbSpacesForCredit.find((s) => Number(s.web3SpaceId ?? 0) === id),
        )
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
    },
    [dbSpacesForCredit],
  );
  const addedCreditSpaces = React.useMemo(
    () => resolveSpacesByIds(addCreditWhitelistSpaceIds),
    [addCreditWhitelistSpaceIds, resolveSpacesByIds],
  );
  const removedCreditSpaces = React.useMemo(
    () => resolveSpacesByIds(removeCreditWhitelistSpaceIds),
    [removeCreditWhitelistSpaceIds, resolveSpacesByIds],
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
        <div className="flex justify-between items-start gap-2">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.maxSupply')}
          </div>
          <div className="text-1 shrink-0">{maxSupplyDisplay}</div>
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
      {resolvedTransferable !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.transferable')}
          </div>
          <div className="text-1">
            {resolvedTransferable
              ? tProposalDetails('labels.yes')
              : tProposalDetails('labels.no')}
          </div>
        </div>
      )}
      {pendingData?.enableAdvancedTransferControls !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tAgreementFlow('plugins.issueNewToken.transfer.advancedControls')}
          </div>
          <div className="text-1">
            {pendingData.enableAdvancedTransferControls
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
      {resolvedUseReceiveWhitelist !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.receiveToWhitelist')}
          </div>
          <div className="text-1">
            {resolvedUseReceiveWhitelist
              ? tProposalDetails('labels.whitelistEnforcementActive')
              : tProposalDetails('labels.whitelistEnforcementInactive')}
          </div>
        </div>
      )}
      {resolvedUseTransferWhitelist !== undefined && (
        <div className="flex justify-between items-center">
          <div className="text-1 text-neutral-11 w-full">
            {tProposalDetails('labels.transferFromWhitelist')}
          </div>
          <div className="text-1">
            {resolvedUseTransferWhitelist
              ? tProposalDetails('labels.whitelistEnforcementActive')
              : tProposalDetails('labels.whitelistEnforcementInactive')}
          </div>
        </div>
      )}
      {showCreditSection && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="text-1 text-neutral-11 font-medium">
              {tProposalDetails('sections.mutualCredit')}
            </div>
            {creditDisabled ? (
              <div className="flex justify-between items-center">
                <div className="text-1 text-neutral-11 w-full">
                  {tProposalDetails('labels.mutualCreditEnabled')}
                </div>
                <div className="text-1">{tProposalDetails('labels.no')}</div>
              </div>
            ) : (
              creditLimitHuman !== undefined && (
                <div className="flex justify-between items-center">
                  <div className="text-1 text-neutral-11 w-full">
                    {tProposalDetails('labels.mutualCreditLimit')}
                  </div>
                  <div className="text-1 text-nowrap">
                    {formatCurrencyValue(creditLimitHuman)}
                    {resolvedSymbol ? ` ${resolvedSymbol}` : ''}
                  </div>
                </div>
              )
            )}
            {addedCreditSpaces.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-1 text-neutral-11">
                  {tProposalDetails('labels.mutualCreditEligibleSpacesAdded')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {addedCreditSpaces.map((s) => (
                    <Badge
                      key={`add-${s.web3SpaceId ?? s.slug}`}
                      variant="outline"
                      className="gap-1.5 py-1 pl-1 pr-2"
                    >
                      <span
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-success-8 bg-success-2 text-[11px] font-semibold leading-none text-success-11"
                        aria-hidden
                      >
                        +
                      </span>
                      <Image
                        className="rounded-full w-5 h-5"
                        src={s.logoUrl ?? '/placeholder/default-profile.svg'}
                        width={20}
                        height={20}
                        alt={tProposalDetails('labels.spaceLogoAlt', {
                          title: s.title,
                        })}
                      />
                      <span className="text-1">{s.title}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {removedCreditSpaces.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-1 text-neutral-11">
                  {tProposalDetails('labels.mutualCreditEligibleSpacesRemoved')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {removedCreditSpaces.map((s) => (
                    <Badge
                      key={`rm-${s.web3SpaceId ?? s.slug}`}
                      variant="outline"
                      className="gap-1.5 py-1 pl-1 pr-2"
                    >
                      <span
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-error-8 bg-error-2 text-[11px] font-semibold leading-none text-error-11"
                        aria-hidden
                      >
                        −
                      </span>
                      <Image
                        className="rounded-full w-5 h-5"
                        src={s.logoUrl ?? '/placeholder/default-profile.svg'}
                        width={20}
                        height={20}
                        alt={tProposalDetails('labels.spaceLogoAlt', {
                          title: s.title,
                        })}
                      />
                      <span className="text-1">{s.title}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {showTransferWhitelistDetails && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            {toWhitelistRender.rows.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-1 text-neutral-11 font-bold">
                  {tProposalDetails('sections.toWhitelist')}
                </div>
                <div className="flex flex-col gap-4">
                  {toWhitelistRender.rows.map((row, idx) => (
                    <WhitelistAddressItem
                      key={`to-${idx}-${row.address}`}
                      address={row.address}
                      diffStatus={
                        toWhitelistRender.showDiff ? row.status : undefined
                      }
                      spaceScope={spaceScopeToPending.get(
                        row.address.toLowerCase(),
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {fromWhitelistRender.rows.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="text-1 text-neutral-11 font-bold">
                  {tProposalDetails('sections.fromWhitelist')}
                </div>
                <div className="flex flex-col gap-4">
                  {fromWhitelistRender.rows.map((row, idx) => (
                    <WhitelistAddressItem
                      key={`from-${idx}-${row.address}`}
                      address={row.address}
                      diffStatus={
                        fromWhitelistRender.showDiff ? row.status : undefined
                      }
                      spaceScope={spaceScopeFromPending.get(
                        row.address.toLowerCase(),
                      )}
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
