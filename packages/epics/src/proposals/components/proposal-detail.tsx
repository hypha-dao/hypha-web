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
} from '../../governance';
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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

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
      const votingDuration =
        durationRaw !== undefined ? Number(durationRaw) : undefined;
      const autoExecution =
        votingDuration !== undefined ? votingDuration === 0 : true;

      let members: { member: string; number: number }[] = [];
      if (votingMethod === '1t1v' || votingMethod === '1v1v') {
        if (token) {
          const tokenLc = token.toLowerCase();
          members = proposalDetails.transfers
            .filter((tx) => tx.token?.toLowerCase() === tokenLc)
            .map((tx) => ({
              member: tx.recipient,
              number: Number(formatUnits(tx.rawAmount, 18)),
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

    return undefined;
  })();

  return (
    <div className="flex flex-col gap-5">
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
        <ButtonClose closeUrl={closeUrl} />
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
      <MarkdownSuspense>{content}</MarkdownSuspense>
      <AttachmentList attachments={attachments || []} />
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
      {proposalDetails?.tokens.map((token, idx) => (
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
          decayPercentage={token.decayPercentage}
          decayInterval={token.decayInterval}
        />
      ))}
      {Boolean(proposalDetails?.transfers?.length) && (
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
        />
      ) : null}
      {label === 'Token Purchase' && proposalDetails?.spaceTokenPurchaseData ? (
        <ProposalSpaceTokenPurchaseData
          dbTokens={dbTokens}
          {...proposalDetails.spaceTokenPurchaseData}
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
        documentDescription={content}
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
        redeemResubmitPayload={redeemResubmitPayloadResolved}
        proposalTemplateData={resubmitTemplateData}
        spaceTokenPurchaseData={proposalDetails?.spaceTokenPurchaseData}
      />
    </div>
  );
};
