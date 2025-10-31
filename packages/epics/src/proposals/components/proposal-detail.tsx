'use client';

import { formatISO } from 'date-fns';
import { FormVoting } from './form-voting';
import { ProposalHead, ProposalHeadProps } from './proposal-head';
import { Separator, AttachmentList, Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';
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
} from '@hypha-platform/core/client';
import {
  ProposalTransactionItem,
  ProposalTokenItem,
  ProposalTokenRequirementsInfo,
  ProposalVotingInfo,
  ProposalMintItem,
  ProposalEntryInfo,
  ProposalBuyHyphaTokensData,
  ProposalDelegatesData,
} from '../../governance';
import { MarkdownSuspense } from '@hypha-platform/ui/server';
import { ButtonClose, ExpireProposalBanner } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { ProposalActivateSpacesData } from '../../governance/components/proposal-activate-spaces-data';
import { useSpaceDocumentsWithStatuses } from '../../governance';
import { isPast } from 'date-fns';
import { useState, useEffect } from 'react';

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
}: ProposalDetailProps) => {
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

  const tokenSymbol = proposalDetails?.tokens?.[0]?.symbol;

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
          createDate={formatDate(
            proposalDetails?.startTime ?? new Date(),
            true,
          )}
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
        />
      ))}
      {Boolean(proposalDetails?.transfers?.length) && (
        <div className="flex flex-col gap-4">
          <span className="text-neutral-11 text-2 font-medium">Payment</span>
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
        <ProposalMintItem key={idx} member={mint.member} number={mint.number} />
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
      />
    </div>
  );
};
