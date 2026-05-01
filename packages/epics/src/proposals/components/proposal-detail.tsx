'use client';

import { formatISO } from 'date-fns';
import { FormVoting } from './form-voting';
import { ProposalHead, ProposalHeadProps } from './proposal-head';
import { Separator, AttachmentList, Skeleton } from '@hypha-platform/ui';
import Image from 'next/image';
import {
  useProposalDetailsWeb3Rpc,
  DbToken,
  DEFAULT_SPACE_LEAD_IMAGE,
  Attachment,
  useSpaceDetailsWeb3Rpc,
  SpaceDetails,
  DirectionType,
  Document,
  useSpaceMinProposalDuration,
  useVote,
  bigIntToPercentageString,
  getTokenDecimals,
  CURRENCY_FEEDS,
  REFERENCE_CURRENCIES,
  TOKENS,
  type Person,
  type Space,
  stripHyphaInvestmentFormMarker,
  getEscrowImplementationAddress,
  parseHyphaInvestmentFormFromDescription,
} from '@hypha-platform/core/client';
import {
  ProposalTransactionItem,
  ProposalTokenItem,
  ProposalTokenRequirementsInfo,
  ProposalVotingInfo,
  ProposalMintItem,
  ProposalBurnItem,
  ProposalEntryInfo,
  ProposalBuyHyphaTokensData,
  ProposalDelegatesData,
  MembershipExitData,
  ProposalTransparencySettingsInfo,
  ProposalTokenBackingVaultData,
  ProposalRedeemTokensData,
  ProposalSpaceTokenPurchaseData,
  ProposalUpdateToken,
  ProposalAcceptInvestmentData,
  ProposalExchangeStakesAndTokensData,
  ProposalEnergyProposalData,
} from '../../governance';
import { parseExchangeDetailsFromDescription } from '../../governance/utils/exchange-details-parser';
import { stripExchangeDetailsBlock } from '../../governance/utils/strip-exchange-details-block';
import { MarkdownSuspense } from '@hypha-platform/ui/server';
import { ButtonClose, ExpireProposalBanner } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { ProposalActivateSpacesData } from '../../governance/components/proposal-activate-spaces-data';
import { useSpaceDocumentsWithStatuses } from '../../governance';
import { isPast } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { TransparencyLevel } from '../../spaces/components/transparency-level';
import { useTranslations } from 'next-intl';
import { formatUnits } from 'viem';
import { resolveTokenDecimals } from '../../governance/utils/token-decimals';
import { useDbSpaces } from '../../hooks';
import { hasUpdateTokenDataToDisplay } from '../utils/has-update-token-data-to-display';
import { normalizeVotingDurationForResubmitSelect } from '../../agreements/plugins/change-voting-method/voting-duration-resubmit';
import { parseEnergyProposalMarker } from '../../governance/utils/energy-proposal-markers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

type ProposalTransferRow = {
  recipient: string;
  rawAmount: bigint;
  token: string;
};

function buildRecipientPayoutsFromTransfers(
  transfers: ProposalTransferRow[] | undefined,
):
  | { recipient: string; payouts: { token: string; amount: string }[] }
  | undefined {
  if (!transfers?.length) return undefined;
  const first = transfers[0];
  if (!first) return undefined;
  const recipient = first.recipient;
  const recipientLc = recipient.toLowerCase();
  if (!transfers.every((t) => t.recipient.toLowerCase() === recipientLc)) {
    return undefined;
  }
  const payouts = transfers.map((tx) => ({
    token: tx.token,
    amount: formatUnits(tx.rawAmount, resolveTokenDecimals(tx.token)),
  }));
  return { recipient, payouts };
}

function referenceCurrencyFromPriceFeed(
  feed: string | undefined,
): string | undefined {
  if (!feed) return undefined;
  const normalized = feed.toLowerCase();
  for (const code of REFERENCE_CURRENCIES) {
    const chainFeed = CURRENCY_FEEDS[code as keyof typeof CURRENCY_FEEDS];
    if (!chainFeed) continue;
    if (normalized === chainFeed.toLowerCase()) {
      return code;
    }
  }
  if (normalized === '0x0000000000000000000000000000000000000000') {
    return 'USD';
  }
  return undefined;
}

function referenceCurrencyFeedAddressFromChainData(
  currencyFeed: string | undefined,
): string | undefined {
  if (!currencyFeed) return undefined;
  const lower = currencyFeed.toLowerCase();
  for (const addr of Object.values(CURRENCY_FEEDS)) {
    if (typeof addr === 'string' && addr.toLowerCase() === lower) {
      return addr;
    }
  }
  return CURRENCY_FEEDS.USD;
}

type ProposalTokenBackingVaultFromDetails = {
  spaceToken?: string;
  addCollaterals?: Array<{
    token: string;
    amount: string;
    decimals: number;
  }>;
  removeCollaterals?: Array<{ token: string; amount: string }>;
  enableRedemption?: boolean;
  redemptionStartDate?: Date;
  redemptionPrice?: string;
  currencyFeed?: string;
  maxRedemptionPercent?: number;
  maxRedemptionPeriodDays?: number;
  minimumBackingPercent?: number;
  whitelistEnabled?: boolean;
  whitelistedAddresses?: string[];
};

function buildTokenBackingVaultResubmitPayload(
  data: ProposalTokenBackingVaultFromDetails,
): Record<string, unknown> | undefined {
  if (!data.spaceToken) return undefined;

  const addCollaterals = (data.addCollaterals ?? []).map((c) => ({
    token: c.token,
    amount: c.amount,
  }));
  const removeCollaterals = (data.removeCollaterals ?? []).map((c) => ({
    token: c.token,
    amount: c.amount,
  }));

  const enableRedemption = Boolean(data.enableRedemption);
  const referenceCurrency = referenceCurrencyFeedAddressFromChainData(
    data.currencyFeed,
  );
  const redemptionWhitelist = (data.whitelistedAddresses ?? []).map((addr) => ({
    type: 'member' as const,
    address: addr,
  }));

  return {
    tokenBackingVault: {
      spaceToken: data.spaceToken,
      activateVault: true,
      enableRedemption,
      addCollaterals,
      removeCollaterals,
      referenceCurrency,
      tokenPrice:
        enableRedemption && data.redemptionPrice
          ? data.redemptionPrice
          : undefined,
      minimumBackingPercent: data.minimumBackingPercent ?? 0,
      maxRedemptionPercent: data.maxRedemptionPercent,
      maxRedemptionPeriodDays: data.maxRedemptionPeriodDays,
      redemptionStartDate: data.redemptionStartDate ?? null,
      enableAdvancedRedemptionControls: Boolean(data.whitelistEnabled),
      redemptionWhitelist,
    },
  };
}

type ProposalTokenFromProposalDetails = {
  tokenType: 'regular' | 'ownership' | 'voice';
  spaceId: bigint;
  name: string;
  symbol: string;
  maxSupply: bigint;
  isVotingToken?: boolean;
  transferable?: boolean;
  fixedMaxSupply?: boolean;
  autoMinting?: boolean;
  priceInUSD?: bigint;
  priceCurrencyFeed?: `0x${string}`;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  initialTransferWhitelist?: `0x${string}`[];
  initialReceiveWhitelist?: `0x${string}`[];
  /**
   * Web3 ids of spaces seeded into the on-chain transfer/receive whitelists at
   * deploy time. Surfaced on the proposal card and used when resubmitting an
   * issue-new-token proposal so the original space rows are re-hydrated.
   */
  initialTransferWhitelistSpaceIds?: readonly bigint[];
  initialReceiveWhitelistSpaceIds?: readonly bigint[];
  decayPercentage?: bigint;
  decayInterval?: bigint;
  address?: string;
};

function buildIssueNewTokenResubmitPayload(
  token: ProposalTokenFromProposalDetails,
  proposalSpaceId: number,
  dbTokens: DbToken[],
  /**
   * Space rows from `useDbSpaces()` — used to convert the new
   * `initial(Transfer|Receive)WhitelistSpaceIds` factory arrays back into
   * `transferWhitelist.from/to` entries of `type: 'space'` so the form can
   * re-render the original space chips.
   */
  dbSpaces: { web3SpaceId?: number | null; address?: string | null }[],
  options?: {
    /** Agreement document id — used to pick the draft token row (icon URL from Web2 before mint). */
    documentId?: number | null;
  },
): Record<string, unknown> {
  const humanSupply = Number(formatUnits(token.maxSupply, 18));
  const enableLimitedSupply = humanSupply > 0;
  const maxSupplyType = token.fixedMaxSupply
    ? {
        label: 'Forever Immutable',
        value: 'immutable' as const,
      }
    : {
        label: 'Updatable Over Time',
        value: 'updatable' as const,
      };

  const enableProposalAutoMinting = token.autoMinting ?? true;
  const transferable = token.transferable ?? true;

  const fromList = token.initialTransferWhitelist ?? [];
  const toList = token.initialReceiveWhitelist ?? [];
  /**
   * Look up space addresses for the encoded `initial(Transfer|Receive)WhitelistSpaceIds`
   * so resubmit emits proper space rows next to member rows. Unresolved ids
   * are dropped (can't round-trip without an address); the user can re-add
   * them manually if needed.
   */
  const fromSpaceIds = (token.initialTransferWhitelistSpaceIds ?? []).map(
    (id) => Number(id),
  );
  const toSpaceIds = (token.initialReceiveWhitelistSpaceIds ?? []).map((id) =>
    Number(id),
  );
  const fromSpaceRows = fromSpaceIds
    .map((id) => dbSpaces.find((s) => Number(s.web3SpaceId ?? -1) === id))
    .filter(
      (s): s is { web3SpaceId?: number | null; address?: string | null } =>
        Boolean(s?.address),
    );
  const toSpaceRows = toSpaceIds
    .map((id) => dbSpaces.find((s) => Number(s.web3SpaceId ?? -1) === id))
    .filter(
      (s): s is { web3SpaceId?: number | null; address?: string | null } =>
        Boolean(s?.address),
    );
  const hasWhitelistAddresses =
    fromList.length > 0 ||
    toList.length > 0 ||
    fromSpaceRows.length > 0 ||
    toSpaceRows.length > 0;
  const enableAdvancedTransferControls = Boolean(
    (token.useTransferWhitelist || token.useReceiveWhitelist) &&
      hasWhitelistAddresses,
  );

  const matchedDb =
    (token.address
      ? dbTokens.find(
          (t) => t.address?.toLowerCase() === token.address?.toLowerCase(),
        )
      : undefined) ??
    dbTokens.find(
      (t) =>
        t.spaceId === proposalSpaceId &&
        t.symbol?.toUpperCase() === token.symbol.toUpperCase(),
    );

  const draftTokenForAgreement =
    options?.documentId != null
      ? dbTokens.find((t) => t.agreementId === options.documentId)
      : undefined;

  /**
   * Resubmit must mirror a normal create: pass decoded contract addresses only.
   * Avoid member/space classification from UI lists — incomplete mapping broke web3 encode / create flow.
   */
  let transferWhitelist:
    | {
        from?: { type: 'member' | 'space'; address: string }[];
        to?: { type: 'member' | 'space'; address: string }[];
      }
    | undefined;

  if (enableAdvancedTransferControls && hasWhitelistAddresses) {
    transferWhitelist = {};
    const fromEntries = [
      ...fromList.map((addr) => ({
        type: 'member' as const,
        address: addr as string,
      })),
      ...fromSpaceRows.map((s) => ({
        type: 'space' as const,
        address: s.address as string,
      })),
    ];
    const toEntries = [
      ...toList.map((addr) => ({
        type: 'member' as const,
        address: addr as string,
      })),
      ...toSpaceRows.map((s) => ({
        type: 'space' as const,
        address: s.address as string,
      })),
    ];
    if (fromEntries.length > 0) {
      transferWhitelist.from = fromEntries;
    }
    if (toEntries.length > 0) {
      transferWhitelist.to = toEntries;
    }
  }

  const priceMicro =
    token.priceInUSD !== undefined ? Number(token.priceInUSD) : 0;
  const enableTokenPrice = priceMicro > 0;
  const tokenPrice = enableTokenPrice ? priceMicro / 1_000_000 : undefined;

  const feedAddr = token.priceCurrencyFeed as string | undefined;
  const referenceCurrencyFromChain = referenceCurrencyFromPriceFeed(feedAddr);

  let referenceCurrencyResolved = referenceCurrencyFromChain;
  if (enableTokenPrice && matchedDb?.referenceCurrency) {
    referenceCurrencyResolved = matchedDb.referenceCurrency;
  } else if (enableTokenPrice && !referenceCurrencyResolved) {
    referenceCurrencyResolved = 'USD';
  }

  const tokenPriceResolved =
    enableTokenPrice && matchedDb?.referencePrice != null
      ? matchedDb.referencePrice
      : tokenPrice;

  const formType =
    matchedDb?.type ??
    (token.tokenType === 'voice'
      ? 'voice'
      : token.tokenType === 'ownership'
      ? 'ownership'
      : 'utility');

  const decaySettings =
    formType === 'voice' &&
    token.decayInterval !== undefined &&
    token.decayPercentage !== undefined
      ? {
          decayInterval: Number(token.decayInterval),
          decayPercentage: Number(token.decayPercentage),
        }
      : {
          decayInterval: 2592000,
          decayPercentage: 1,
        };

  const iconUrl =
    typeof draftTokenForAgreement?.iconUrl === 'string' &&
    draftTokenForAgreement.iconUrl.length > 0
      ? draftTokenForAgreement.iconUrl
      : typeof matchedDb?.iconUrl === 'string' && matchedDb.iconUrl.length > 0
      ? matchedDb.iconUrl
      : undefined;

  return {
    name: token.name,
    symbol: token.symbol,
    ...(iconUrl ? { iconUrl } : {}),
    type: formType,
    maxSupply: humanSupply,
    ...(enableLimitedSupply ? { maxSupplyType } : {}),
    decaySettings,
    isVotingToken: formType === 'voice',
    transferable,
    enableAdvancedTransferControls,
    ...(transferWhitelist ? { transferWhitelist } : {}),
    enableProposalAutoMinting,
    enableLimitedSupply,
    enableTokenPrice,
    ...(enableTokenPrice
      ? {
          referenceCurrency: referenceCurrencyResolved,
          tokenPrice: tokenPriceResolved,
        }
      : {}),
  };
}

type ProposalDetailProps = ProposalHeadProps & {
  documentId?: number;
  content?: string;
  closeUrl: string;
  leadImage?: string;
  attachments?: (string | Attachment)[];
  proposalId?: number | null | undefined;
  spaceSlug: string;
  label?: string;
  documentSlug: string;
  dbTokens?: DbToken[];
  authToken?: string | null;
  onAccept?: () => Promise<void>;
  onReject?: () => Promise<void>;
  onCheckProposalExpiration?: () => Promise<void>;
  isCheckingExpiration?: boolean;
  isVoting?: boolean;
  onWithdrawSuccess?: () => Promise<void>;
  /** Used to map whitelist addresses to member/space rows when resubmitting Issue New Token. */
  membersForWhitelist?: Person[];
  spacesForWhitelist?: Space[];
};

type DocumentsArrays = {
  accepted: Document[];
  rejected: Document[];
  onVoting: Document[];
};

export const ProposalDetail = ({
  documentId,
  creator,
  title,
  commitment,
  status,
  isLoading,
  content,
  closeUrl,
  leadImage,
  attachments,
  proposalId,
  spaceSlug,
  label,
  documentSlug,
  dbTokens,
  authToken,
  onAccept,
  onReject,
  onCheckProposalExpiration,
  isCheckingExpiration: externalIsCheckingExpiration,
  isVoting: externalIsVoting,
  onWithdrawSuccess,
  membersForWhitelist,
  spacesForWhitelist,
}: ProposalDetailProps) => {
  const tProposalDetails = useTranslations('ProposalDetails');
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: proposalId as number,
  });
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(proposalDetails?.spaceId),
  });
  const { isAuthenticated } = useAuthentication();
  const { documents: documentsArrays } = useSpaceDocumentsWithStatuses({
    spaceId: Number(proposalDetails?.spaceId),
    spaceSlug,
    order: [
      {
        name: 'createdAt',
        dir: DirectionType.DESC,
      },
    ],
  });
  const { spaces: dbSpaces } = useDbSpaces({ parentOnly: false });

  const updateTokenTypeFromDb = useMemo(() => {
    const addr = proposalDetails?.updateTokenData?.address;
    if (!addr || !dbTokens?.length) {
      return undefined;
    }
    const normalized = addr.toLowerCase();
    return dbTokens.find((t) => t.address?.toLowerCase() === normalized)?.type;
  }, [proposalDetails?.updateTokenData?.address, dbTokens]);

  const isUpdateTokenOwnershipForResubmit = useMemo(() => {
    if (
      label !== 'Update Token' ||
      !proposalDetails?.updateTokenData?.address
    ) {
      return undefined;
    }
    const t = updateTokenTypeFromDb as string | undefined;
    if (t === 'ownership') return true;
    if (t !== undefined && t !== 'ownership') return false;
    return undefined;
  }, [label, proposalDetails?.updateTokenData?.address, updateTokenTypeFromDb]);

  const spacesForWhitelistDisplay = useMemo(() => {
    const u = proposalDetails?.updateTokenData;
    if (!u || !dbSpaces?.length) {
      return [];
    }
    const a = u.initialTransferWhitelistSpaceIds ?? [];
    const b = u.initialReceiveWhitelistSpaceIds ?? [];
    const want = new Set(
      [...new Set([...a, ...b])].filter((n) => Number.isFinite(n)),
    );
    if (want.size === 0) {
      return [];
    }
    return dbSpaces.filter(
      (s) => s.web3SpaceId != null && want.has(Number(s.web3SpaceId)),
    );
  }, [
    dbSpaces,
    proposalDetails?.updateTokenData?.initialTransferWhitelistSpaceIds,
    proposalDetails?.updateTokenData?.initialReceiveWhitelistSpaceIds,
  ]);

  const tokenSymbol = proposalDetails?.tokens?.[0]?.symbol;

  const redeemChainDataForResubmit = useMemo(() => {
    if (label !== 'Redeem Tokens') return null;
    const r = proposalDetails?.redeemTokensData;
    if (!r?.amount || !r?.token || !r.conversions?.length) {
      return null;
    }
    return {
      token: r.token,
      amount: r.amount,
      conversions: r.conversions.map((c) => ({
        asset: c.asset,
        percentage: bigIntToPercentageString(c.percentage),
      })),
    };
  }, [
    label,
    proposalDetails?.redeemTokensData?.amount,
    proposalDetails?.redeemTokensData?.token,
    proposalDetails?.redeemTokensData?.conversions,
  ]);

  const [redeemResubmitPayloadResolved, setRedeemResubmitPayloadResolved] =
    useState<
      | {
          token: string;
          amount: string;
          conversions: { asset: string; percentage: string }[];
        }
      | undefined
    >(undefined);

  useEffect(() => {
    if (!redeemChainDataForResubmit) {
      setRedeemResubmitPayloadResolved(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const decimals = await getTokenDecimals(
          redeemChainDataForResubmit.token,
        );
        const amount = formatUnits(redeemChainDataForResubmit.amount, decimals);
        if (!cancelled) {
          setRedeemResubmitPayloadResolved({
            token: redeemChainDataForResubmit.token,
            amount,
            conversions: redeemChainDataForResubmit.conversions,
          });
        }
      } catch {
        if (!cancelled) setRedeemResubmitPayloadResolved(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redeemChainDataForResubmit]);

  const {
    handleAccept: internalHandleAccept,
    handleReject: internalHandleReject,
    handleCheckProposalExpiration: internalHandleCheckProposalExpiration,
    isCheckingExpiration: internalIsCheckingExpiration,
    isVoting: internalIsVoting,
    isDeletingToken,
    isUpdatingToken,
  } = useVote({
    documentId,
    proposalId,
    tokenSymbol,
    authToken,
  });

  const handleAccept = onAccept || internalHandleAccept;
  const handleReject = onReject || internalHandleReject;
  const handleCheckProposalExpiration =
    onCheckProposalExpiration || internalHandleCheckProposalExpiration;
  const isCheckingExpiration =
    externalIsCheckingExpiration !== undefined
      ? externalIsCheckingExpiration
      : internalIsCheckingExpiration;
  const isVoting =
    externalIsVoting !== undefined ? externalIsVoting : internalIsVoting;

  const findDocumentStatus = (
    documentsArrays: DocumentsArrays,
    proposalId: number | null | undefined,
  ): string | null => {
    if (!documentsArrays || proposalId == null) return null;
    if (
      documentsArrays.accepted?.some(
        (doc: Document) => doc.web3ProposalId === proposalId,
      )
    ) {
      return 'accepted';
    }
    if (
      documentsArrays.rejected?.some(
        (doc: Document) => doc.web3ProposalId === proposalId,
      )
    ) {
      return 'rejected';
    }
    if (
      documentsArrays.onVoting?.some(
        (doc: Document) => doc.web3ProposalId === proposalId,
      )
    ) {
      return 'onVoting';
    }
    return null;
  };

  const proposalStatus = findDocumentStatus(documentsArrays, proposalId);

  const hideDurationData = () => {
    return (
      proposalStatus === 'accepted' ||
      proposalStatus === 'rejected' ||
      displayExpireProposalBanner
    );
  };

  const spaceIdBigInt = proposalDetails?.spaceId
    ? BigInt(proposalDetails?.spaceId)
    : null;

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });

  const [displayExpireProposalBanner, setDisplayExpireProposalBanner] =
    useState(false);
  const [quorumReached, setQuorumReached] = useState(false);
  const [unityReached, setUnityReached] = useState(false);
  const [isActionCompleted, setIsActionCompleted] = useState(false);
  const [isExpiring, setIsExpiring] = useState(false);

  const onHandleCheckProposalExpiration = async () => {
    try {
      setIsExpiring(true);
      await handleCheckProposalExpiration();
    } catch (error) {
      console.error('Error checking proposal expiration:', error);
    } finally {
      setIsExpiring(false);
    }
  };

  useEffect(() => {
    const isProposalExpired = Boolean(
      proposalDetails?.endTime && isPast(new Date(proposalDetails.endTime)),
    );

    const isDurationZero = duration === 0n;

    const isQuorumReached = Boolean(
      Number(proposalDetails?.quorumPercentage ?? 0) >=
        Number(spaceDetails?.quorum ?? 0),
    );
    setQuorumReached(isQuorumReached);

    const isUnityReached = Boolean(
      Number(proposalDetails?.unityPercentage ?? 0) >=
        Number(spaceDetails?.unity ?? 0),
    );
    setUnityReached(isUnityReached);

    let shouldShowBanner = false;

    if (
      isProposalExpired &&
      !proposalDetails?.executed &&
      !proposalDetails?.expired
    ) {
      if (!isDurationZero) {
        shouldShowBanner = true;
      } else {
        const conditionsMet = isQuorumReached && isUnityReached;
        if (!conditionsMet) {
          shouldShowBanner = true;
        }
      }
    }

    setDisplayExpireProposalBanner(shouldShowBanner);
  }, [duration, proposalDetails, spaceDetails]);

  useEffect(() => {
    if (proposalDetails?.executed || proposalDetails?.expired) {
      setIsActionCompleted(true);
    }
  }, [proposalDetails?.executed, proposalDetails?.expired]);

  const resubmitTemplateData = (() => {
    if (!proposalDetails) return undefined;

    if (label === 'Treasury Minting') {
      const minting = proposalDetails.mintings?.[0];
      if (!minting) return undefined;
      const decimals = resolveTokenDecimals(minting.token);

      return {
        mint: {
          token: minting.token,
          amount: formatUnits(minting.number, decimals),
        },
      };
    }

    if (label === 'Token Burning') {
      const burnings = proposalDetails.burnings;
      const firstBurning = burnings?.[0];
      if (!firstBurning || !burnings.length) return undefined;

      const resolveBurnAddress = (member: `0x${string}` | null) => {
        if (!member) return '';
        if (member !== ZERO_ADDRESS) return member;

        // For self/space sentinel rows, resolve a real space address
        // so the resubmit form can preselect a valid space target.
        const proposalSpaceAddress = dbSpaces.find(
          (space) => space.web3SpaceId === proposalDetails.spaceId,
        )?.address;
        return proposalSpaceAddress ?? '';
      };

      return {
        tokenBurning: {
          token: firstBurning.token,
          burns: burnings.map((burn) => ({
            type:
              burn.member === ZERO_ADDRESS
                ? ('space' as const)
                : ('member' as const),
            address: resolveBurnAddress(burn.member),
            amount: formatUnits(burn.number, resolveTokenDecimals(burn.token)),
            allBalance: burn.allBalance ?? false,
          })),
        },
      };
    }

    if (label === 'Space Transparency') {
      const ts = proposalDetails.transparencySettingsData;
      if (!ts) return undefined;

      const spaceDiscoverability =
        ts.spaceDiscoverability !== undefined &&
        !Number.isNaN(Number(ts.spaceDiscoverability))
          ? Number(ts.spaceDiscoverability)
          : undefined;
      const spaceActivityAccess =
        ts.spaceActivityAccess !== undefined &&
        !Number.isNaN(Number(ts.spaceActivityAccess))
          ? Number(ts.spaceActivityAccess)
          : undefined;

      if (
        spaceDiscoverability === undefined &&
        spaceActivityAccess === undefined
      ) {
        return undefined;
      }

      return {
        ...(spaceDiscoverability !== undefined ? { spaceDiscoverability } : {}),
        ...(spaceActivityAccess !== undefined ? { spaceActivityAccess } : {}),
      };
    }

    if (label === 'Voting Method') {
      const vm = proposalDetails.votingMethods?.[0];
      if (!vm) return undefined;

      const source = vm.votingPowerSource;
      let votingMethod: '1m1v' | '1v1v' | '1t1v' | undefined;
      if (source === 1n) votingMethod = '1t1v';
      else if (source === 2n) votingMethod = '1m1v';
      else if (source === 3n) votingMethod = '1v1v';
      else return undefined;

      const quorum = Number(vm.quorum);
      const unity = Number(vm.unity);
      const token =
        proposalDetails.votingMethodsToken?.token &&
        proposalDetails.votingMethodsToken.token.length > 0
          ? proposalDetails.votingMethodsToken.token
          : '';

      const durationRaw = proposalDetails.minimumProposalDurationData?.duration;
      const durationSeconds =
        durationRaw !== undefined ? Number(durationRaw) : undefined;
      const autoExecution =
        durationSeconds !== undefined ? durationSeconds === 0 : true;
      let votingDuration: number | undefined;
      if (durationSeconds === undefined) {
        votingDuration = undefined;
      } else if (durationSeconds === 0) {
        votingDuration = 0;
      } else {
        votingDuration =
          normalizeVotingDurationForResubmitSelect(durationSeconds);
      }

      let members: { member: string; number: number }[] = [];
      if (votingMethod === '1t1v' || votingMethod === '1v1v') {
        if (token) {
          const tokenLc = token.toLowerCase();
          const dec = resolveTokenDecimals(token);
          members = proposalDetails.transfers
            .filter((tx) => tx.token?.toLowerCase() === tokenLc)
            .map((tx) => ({
              member: tx.recipient,
              number: Number(formatUnits(tx.rawAmount, dec)),
            }))
            .filter(
              (m) => m.member && Number.isFinite(m.number) && m.number > 0,
            );
        }
        if (members.length === 0) {
          members = [
            {
              member: '',
              number: 0,
            },
          ];
        }
      }

      return {
        votingMethod,
        quorumAndUnity: { quorum, unity },
        token,
        members,
        ...(votingDuration !== undefined ? { votingDuration } : {}),
        autoExecution,
      };
    }

    if (label === 'Entry Method') {
      const em = proposalDetails.entryMethods?.[0];
      if (!em) return undefined;

      const entryMethod = Number(em.joinMethod);
      if (entryMethod < 0 || entryMethod > 2) return undefined;

      let tokenBase: { token: string; amount: number } | undefined;
      if (entryMethod === 1) {
        const spaceIdBn = BigInt(proposalDetails.spaceId);
        const tr = proposalDetails.tokenRequirements?.find(
          (r) => r.spaceId === spaceIdBn,
        );
        if (tr) {
          tokenBase = {
            token: tr.token,
            amount: Number(tr.amount),
          };
        }
      }

      return {
        entryMethod,
        ...(tokenBase ? { tokenBase } : {}),
      };
    }

    if (label === 'Membership Exit') {
      const me = proposalDetails.membershipExitData;
      if (!me?.member || me.space === undefined) return undefined;

      return {
        space: Number(me.space),
        member: me.member,
      };
    }

    if (label === 'Space To Space') {
      const dd = proposalDetails.delegatesData;
      if (!dd?.member || dd.space === undefined) return undefined;

      const targetWeb3Id = Number(dd.space);
      if (!Number.isFinite(targetWeb3Id)) return undefined;

      const targetSpaceAddress = dbSpaces.find(
        (s) => s.web3SpaceId === targetWeb3Id,
      )?.address;
      if (!targetSpaceAddress) return undefined;

      return {
        spaceToSpaceTargetAddress: targetSpaceAddress,
        spaceToSpaceMemberAddress: dd.member,
      };
    }

    if (label === 'Issue New Token') {
      const tok = proposalDetails.tokens?.[0];
      if (!tok?.name || !tok?.symbol) return undefined;

      return {
        issueNewTokenForm: buildIssueNewTokenResubmitPayload(
          tok as ProposalTokenFromProposalDetails,
          proposalDetails.spaceId,
          dbTokens ?? [],
          dbSpaces ?? [],
          { documentId },
        ),
      };
    }

    if (label === 'Backing Vault') {
      const vaultPayload = buildTokenBackingVaultResubmitPayload(
        proposalDetails.tokenBackingVaultData as ProposalTokenBackingVaultFromDetails,
      );
      if (!vaultPayload) return undefined;
      return vaultPayload;
    }

    if (label === 'Funding') {
      const fromTransfers = buildRecipientPayoutsFromTransfers(
        proposalDetails.transfers,
      );
      if (!fromTransfers) return undefined;
      return { deployFundsForm: fromTransfers };
    }

    if (label === 'Contribution') {
      const fromTransfers = buildRecipientPayoutsFromTransfers(
        proposalDetails.transfers,
      );
      if (!fromTransfers) return undefined;
      return { proposeContributionForm: fromTransfers };
    }

    if (label === 'Expenses') {
      const fromTransfers = buildRecipientPayoutsFromTransfers(
        proposalDetails.transfers,
      );
      if (!fromTransfers) return undefined;
      return { payForExpensesForm: fromTransfers };
    }

    if (label === 'Buy Hypha Tokens') {
      const rawAmount = proposalDetails.buyHyphaTokensData?.amount;
      if (rawAmount === undefined) return undefined;

      const usdcMeta = TOKENS.find((t) => t.symbol === 'USDC');
      const payDecimals = resolveTokenDecimals(usdcMeta?.address ?? '');
      const amountStr = formatUnits(rawAmount, payDecimals);

      const buyHyphaRecipient = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

      return {
        buyHyphaTokensForm: {
          payout: {
            amount: amountStr,
            token: usdcMeta?.address ?? '',
          },
          recipient: buyHyphaRecipient,
        },
      };
    }

    if (label === 'Token Purchase') {
      const st = proposalDetails.spaceTokenPurchaseData;
      if (!st?.tokenAddress) return undefined;

      const paymentLc = st.paymentToken?.toLowerCase();
      const usdcLc = TOKENS.find(
        (t) => t.symbol === 'USDC',
      )?.address?.toLowerCase();
      const eurcLc = TOKENS.find(
        (t) => t.symbol === 'EURC',
      )?.address?.toLowerCase();
      let purchaseCurrency: 'USD' | 'EUR' | undefined;
      if (paymentLc && eurcLc && paymentLc === eurcLc) {
        purchaseCurrency = 'EUR';
      } else if (paymentLc && usdcLc && paymentLc === usdcLc) {
        purchaseCurrency = 'USD';
      }

      const payDecimals = resolveTokenDecimals(st.paymentToken ?? '');
      const saleDecimals = resolveTokenDecimals(st.tokenAddress);
      const purchasePrice =
        st.paymentTokenPricePerToken !== undefined
          ? Number(formatUnits(st.paymentTokenPricePerToken, payDecimals))
          : undefined;
      const tokensAvailableForPurchase =
        st.tokensForSale !== undefined
          ? Number(formatUnits(st.tokensForSale, saleDecimals))
          : undefined;

      const canRestoreActiveToggle = Boolean(
        st.isActive && purchaseCurrency !== undefined,
      );

      return {
        spaceTokenPurchaseForm: {
          tokenAddress: st.tokenAddress,
          activatePurchase: canRestoreActiveToggle,
          ...(canRestoreActiveToggle
            ? {
                purchaseCurrency,
                purchasePrice,
                tokensAvailableForPurchase,
              }
            : {}),
        },
      };
    }

    return undefined;
  })();

  const investmentResubmit = (() => {
    if (label !== 'Investment') return undefined;
    const fromMarker = parseHyphaInvestmentFormFromDescription(content);
    if (fromMarker) {
      return {
        recipient: fromMarker.investorAddress,
        investorSendLegs: fromMarker.investorSendLegs,
        ...(fromMarker.spaceReceiveLegs?.length
          ? { spaceReceiveLegs: fromMarker.spaceReceiveLegs }
          : {}),
      };
    }
    const ex = proposalDetails?.exchangeEscrowData;
    if (
      !ex?.partyB ||
      !ex.tokenA ||
      !ex.tokenB ||
      ex.amountA === undefined ||
      ex.amountB === undefined
    ) {
      return undefined;
    }
    const da = resolveTokenDecimals(ex.tokenA);
    const db = resolveTokenDecimals(ex.tokenB);
    return {
      recipient: ex.partyB,
      investorSendLegs: [
        { amount: formatUnits(ex.amountB, db), token: ex.tokenB },
      ],
      spaceReceiveLegs: [
        { amount: formatUnits(ex.amountA, da), token: ex.tokenA },
      ],
    };
  })();

  const resubmitTemplateDataMerged =
    label === 'Investment' && investmentResubmit
      ? { ...resubmitTemplateData, ...investmentResubmit }
      : resubmitTemplateData;

  // Description handed to FormVoting → resubmit session storage. Strip
  // template-specific markers (investment JSON / exchange-details block) so
  // the resubmit form's editor only shows the user-authored prose. The
  // create form re-emits its own marker on submit; carrying the marker
  // through the editor caused doubled-marker descriptions and a JSON-in-MDX
  // crash when the resubmitted proposal was opened.
  const resubmitDescription =
    label === 'Investment'
      ? stripHyphaInvestmentFormMarker(content ?? '')
      : label === 'Exchange'
      ? stripExchangeDetailsBlock(content ?? '')
      : content;

  const energyMarkerData = useMemo(() => {
    if (
      label !== 'Enable Energy Community' &&
      label !== 'Energy Sharing' &&
      label !== 'Register Energy Source' &&
      label !== 'Add Energy Member'
    ) {
      return null;
    }
    const parsed = parseEnergyProposalMarker(content);
    if (
      !parsed ||
      typeof parsed.payload !== 'object' ||
      parsed.payload === null
    ) {
      return null;
    }
    return {
      proposalType: parsed.proposalType,
      payload: parsed.payload as Record<string, unknown>,
    };
  }, [label, content]);

  const escrowAddr = getEscrowImplementationAddress();

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-[5] -mx-4 bg-background-2 lg:-mx-7">
        <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-border px-4 lg:px-7">
          <ButtonClose closeUrl={closeUrl} className="px-0 md:px-3" />
        </div>
      </div>
      <div className="flex gap-2 justify-between">
        <ProposalHead
          creator={creator}
          title={title}
          commitment={commitment}
          status={status}
          isLoading={isLoading}
          label={label}
          createDate={
            proposalDetails?.startTime
              ? new Date(proposalDetails.startTime)
              : undefined
          }
          proposalStatus={proposalStatus}
        />
      </div>
      <Separator />
      <Skeleton
        width="100%"
        height="150px"
        loading={isLoading}
        className="rounded-lg"
      >
        <Image
          height={150}
          width={554}
          className="w-full object-cover rounded-lg max-h-[150px]"
          src={leadImage || DEFAULT_SPACE_LEAD_IMAGE}
          alt={title ?? ''}
        />
      </Skeleton>
      <ExpireProposalBanner
        isDisplay={displayExpireProposalBanner}
        quorumReached={quorumReached}
        unityReached={unityReached}
        quorumPercentage={proposalDetails?.quorumPercentage || 0}
        unityPercentage={proposalDetails?.unityPercentage || 0}
        onHandleAction={onHandleCheckProposalExpiration}
        isActionCompleted={isActionCompleted}
        isExpiring={isExpiring}
        web3SpaceId={proposalDetails?.spaceId}
      />
      <MarkdownSuspense>
        {label === 'Investment'
          ? stripHyphaInvestmentFormMarker(content ?? '')
          : label === 'Exchange'
          ? stripExchangeDetailsBlock(content ?? '')
          : content}
      </MarkdownSuspense>
      <AttachmentList attachments={attachments || []} />
      {label === 'Investment' ? (
        <ProposalAcceptInvestmentData
          descriptionMarkdown={content}
          spaceSlug={spaceSlug}
          exchangeEscrowData={proposalDetails?.exchangeEscrowData}
        />
      ) : null}
      {label === 'Exchange'
        ? (() => {
            const parsed = parseExchangeDetailsFromDescription(content);
            if (!parsed) return null;
            return (
              <ProposalExchangeStakesAndTokensData
                spaceSlug={spaceSlug}
                sellerAddress={parsed.sellerAddress}
                buyerAddress={parsed.buyerAddress}
                sellerLeg={parsed.sellerLeg}
                buyerLeg={parsed.buyerLeg}
                dbTokens={dbTokens}
              />
            );
          })()
        : null}
      {proposalDetails?.votingMethods.map((method, idx) => (
        <ProposalVotingInfo
          key={idx}
          votingPowerSource={method.votingPowerSource}
          unity={method.unity}
          quorum={method.quorum}
          token={proposalDetails?.votingMethodsToken}
          spaceSlug={spaceSlug}
          minimumProposalVotingDuration={
            proposalDetails?.minimumProposalDurationData?.duration
          }
        />
      ))}
      {proposalDetails?.entryMethods.map((method, idx) => (
        <ProposalEntryInfo key={idx} joinMethod={method.joinMethod} />
      ))}
      {proposalDetails?.tokenRequirements.map((method, idx) => (
        <ProposalTokenRequirementsInfo
          key={idx}
          token={method.token}
          amount={method.amount}
          spaceSlug={spaceSlug}
        />
      ))}
      {label !== 'Investment' &&
        label !== 'Exchange' &&
        proposalDetails?.tokens.map((token, idx) => (
          <ProposalTokenItem
            key={idx}
            name={token.name}
            symbol={token.symbol}
            address={token.address}
            initialSupply={token.maxSupply}
            dbTokens={dbTokens}
            transferable={token.transferable}
            fixedMaxSupply={token.fixedMaxSupply}
            autoMinting={token.autoMinting}
            priceInUSD={token.priceInUSD}
            useTransferWhitelist={token.useTransferWhitelist}
            useReceiveWhitelist={token.useReceiveWhitelist}
            initialTransferWhitelist={token.initialTransferWhitelist}
            initialReceiveWhitelist={token.initialReceiveWhitelist}
            initialTransferWhitelistSpaceIds={
              token.initialTransferWhitelistSpaceIds
            }
            initialReceiveWhitelistSpaceIds={
              token.initialReceiveWhitelistSpaceIds
            }
            decayPercentage={token.decayPercentage}
            decayInterval={token.decayInterval}
            defaultCreditLimit={token.defaultCreditLimit}
            initialCreditWhitelistSpaceIds={
              token.initialCreditWhitelistSpaceIds
            }
          />
        ))}
      {Boolean(proposalDetails?.transfers?.length) &&
        label !== 'Investment' &&
        label !== 'Exchange' && (
          <div className="flex flex-col gap-4">
            <span className="text-neutral-11 text-2 font-medium">
              {tProposalDetails('sections.payment')}
            </span>
            {proposalDetails?.transfers.map((tx, idx) => (
              <ProposalTransactionItem
                key={idx}
                recipient={tx?.recipient}
                amount={tx?.rawAmount}
                tokenAddress={tx?.token}
                spaceSlug={spaceSlug}
                escrowContractAddress={escrowAddr}
              />
            ))}
          </div>
        )}
      {proposalDetails?.mintings.map((mint, idx) => (
        <ProposalMintItem
          key={idx}
          member={mint.member}
          number={mint.number}
          token={mint.token}
        />
      ))}
      {proposalDetails?.burnings.map((burn, idx) => (
        <ProposalBurnItem
          key={`${burn.member}-${burn.token}-${idx}`}
          member={burn.member}
          number={burn.number}
          token={burn.token}
        />
      ))}
      {proposalDetails?.buyHyphaTokensData.amount ? (
        <ProposalBuyHyphaTokensData
          amount={proposalDetails?.buyHyphaTokensData.amount}
        />
      ) : null}
      {proposalDetails?.activateSpacesData.spaceIds.length ? (
        <ProposalActivateSpacesData
          spaceIds={proposalDetails?.activateSpacesData?.spaceIds}
          paymentAmounts={proposalDetails?.activateSpacesData?.paymentAmounts}
          tokenSymbol={proposalDetails?.activateSpacesData?.tokenSymbol}
        />
      ) : null}
      {proposalDetails?.delegatesData?.member ? (
        <ProposalDelegatesData
          member={proposalDetails?.delegatesData.member}
          space={proposalDetails?.delegatesData.space}
        />
      ) : null}
      {proposalDetails?.membershipExitData?.member ? (
        <MembershipExitData
          member={proposalDetails?.membershipExitData.member}
          space={proposalDetails?.membershipExitData.space}
        />
      ) : null}
      {proposalDetails?.transparencySettingsData &&
      (proposalDetails.transparencySettingsData.spaceDiscoverability !==
        undefined ||
        proposalDetails.transparencySettingsData.spaceActivityAccess !==
          undefined) ? (
        <ProposalTransparencySettingsInfo
          spaceDiscoverability={
            proposalDetails.transparencySettingsData.spaceDiscoverability !==
            undefined
              ? (proposalDetails.transparencySettingsData
                  .spaceDiscoverability as TransparencyLevel)
              : undefined
          }
          spaceActivityAccess={
            proposalDetails.transparencySettingsData.spaceActivityAccess !==
            undefined
              ? (proposalDetails.transparencySettingsData
                  .spaceActivityAccess as TransparencyLevel)
              : undefined
          }
        />
      ) : null}
      {proposalDetails?.redeemTokensData.amount &&
      proposalDetails?.redeemTokensData.token ? (
        <ProposalRedeemTokensData
          spaceSlug={spaceSlug}
          dbTokens={dbTokens}
          amount={proposalDetails.redeemTokensData.amount}
          token={proposalDetails.redeemTokensData.token}
          web3SpaceId={proposalDetails.redeemTokensData.web3SpaceId}
          conversions={proposalDetails.redeemTokensData.conversions}
        />
      ) : null}
      {proposalDetails?.tokenBackingVaultData &&
      !(
        proposalDetails?.redeemTokensData.amount &&
        proposalDetails?.redeemTokensData.token
      ) ? (
        <ProposalTokenBackingVaultData
          spaceSlug={spaceSlug}
          dbTokens={dbTokens}
          {...proposalDetails.tokenBackingVaultData}
        />
      ) : null}
      {proposalDetails &&
      hasUpdateTokenDataToDisplay(proposalDetails.updateTokenData) ? (
        <ProposalUpdateToken
          documentId={documentId}
          address={proposalDetails.updateTokenData.address as `0x${string}`}
          tokenType={updateTokenTypeFromDb}
          name={proposalDetails.updateTokenData.name}
          symbol={proposalDetails.updateTokenData.symbol}
          maxSupply={proposalDetails.updateTokenData.maxSupply}
          transferable={proposalDetails.updateTokenData.transferable}
          autoMinting={proposalDetails.updateTokenData.autoMinting}
          priceWithCurrency={proposalDetails.updateTokenData.priceWithCurrency}
          decayPercentage={proposalDetails.updateTokenData.decayPercentage}
          decayInterval={proposalDetails.updateTokenData.decayInterval}
          useTransferWhitelist={
            proposalDetails.updateTokenData.useTransferWhitelist
          }
          useReceiveWhitelist={
            proposalDetails.updateTokenData.useReceiveWhitelist
          }
          initialTransferWhitelist={
            proposalDetails.updateTokenData.initialTransferWhitelist
          }
          initialReceiveWhitelist={
            proposalDetails.updateTokenData.initialReceiveWhitelist
          }
          initialTransferWhitelistSpaceIds={
            proposalDetails.updateTokenData.initialTransferWhitelistSpaceIds
          }
          initialReceiveWhitelistSpaceIds={
            proposalDetails.updateTokenData.initialReceiveWhitelistSpaceIds
          }
          spacesForWhitelistDisplay={spacesForWhitelistDisplay}
          dbTokens={dbTokens}
          archiveToken={proposalDetails.updateTokenData.archiveToken}
          fixedMaxSupply={proposalDetails.updateTokenData.fixedMaxSupply}
          defaultCreditLimit={
            proposalDetails.updateTokenData.defaultCreditLimit
          }
          addCreditWhitelistSpaceIds={
            proposalDetails.updateTokenData.addCreditWhitelistSpaceIds
          }
          removeCreditWhitelistSpaceIds={
            proposalDetails.updateTokenData.removeCreditWhitelistSpaceIds
          }
        />
      ) : null}
      {label === 'Token Purchase' && proposalDetails?.spaceTokenPurchaseData ? (
        <ProposalSpaceTokenPurchaseData
          dbTokens={dbTokens}
          {...proposalDetails.spaceTokenPurchaseData}
        />
      ) : null}
      {energyMarkerData ? (
        <ProposalEnergyProposalData
          proposalType={energyMarkerData.proposalType}
          payload={energyMarkerData.payload}
        />
      ) : null}
      <FormVoting
        unity={proposalDetails?.unityPercentage || 0}
        quorum={proposalDetails?.quorumPercentage || 0}
        endTime={formatISO(new Date(proposalDetails?.endTime || new Date()))}
        executed={proposalDetails?.executed}
        expired={proposalDetails?.expired}
        onAccept={handleAccept}
        onReject={handleReject}
        isCheckingExpiration={isCheckingExpiration}
        isLoading={isLoading}
        isVoting={isVoting}
        documentSlug={documentSlug}
        isAuthenticated={isAuthenticated}
        web3SpaceId={proposalDetails?.spaceId}
        spaceDetails={spaceDetails as unknown as SpaceDetails}
        proposalStatus={proposalStatus}
        hideDurationData={hideDurationData()}
        proposalId={proposalId ?? null}
        proposalCreator={proposalDetails?.creator ?? null}
        documentTitle={title}
        documentDescription={resubmitDescription}
        documentLeadImage={leadImage}
        documentAttachments={attachments}
        spaceSlug={spaceSlug}
        closeUrl={closeUrl}
        onWithdrawSuccess={onWithdrawSuccess}
        label={label}
        documentId={documentId}
        updateTokenProposalSnapshot={
          label === 'Update Token'
            ? proposalDetails?.updateTokenData ?? null
            : undefined
        }
        updateTokenDecodedWhitelist={
          label === 'Update Token' && proposalDetails?.updateTokenData
            ? {
                initialTransferWhitelist:
                  proposalDetails.updateTokenData.initialTransferWhitelist,
                initialReceiveWhitelist:
                  proposalDetails.updateTokenData.initialReceiveWhitelist,
                initialTransferWhitelistSpaceIds:
                  proposalDetails.updateTokenData
                    .initialTransferWhitelistSpaceIds,
                initialReceiveWhitelistSpaceIds:
                  proposalDetails.updateTokenData
                    .initialReceiveWhitelistSpaceIds,
              }
            : undefined
        }
        membersForUpdateTokenResubmit={membersForWhitelist}
        spacesForUpdateTokenResubmit={spacesForWhitelist}
        dbSpacesForUpdateTokenResubmit={dbSpaces}
        isOwnershipTokenForUpdateTokenResubmit={
          isUpdateTokenOwnershipForResubmit
        }
        redeemResubmitPayload={redeemResubmitPayloadResolved}
        proposalTemplateData={resubmitTemplateDataMerged}
      />
    </div>
  );
};
