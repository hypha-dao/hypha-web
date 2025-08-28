'use client';

import { formatISO } from 'date-fns';
import { FormVoting } from './form-voting';
import { ProposalHead, ProposalHeadProps } from './proposal-head';
import { Separator, AttachmentList, Skeleton } from '@hypha-platform/ui';
import { formatDate } from '@hypha-platform/ui-utils';
// TODO(#891): restore when comments support is implemented
// import { CommentsList } from '../../interactions/components/comments-list';
import Image from 'next/image';
import {
  useProposalDetailsWeb3Rpc,
  DbToken,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import {
  ProposalTransactionItem,
  ProposalTokenItem,
  ProposalTokenRequirementsInfo,
  ProposalVotingInfo,
  ProposalMintItem,
  ProposalEntryInfo,
} from '../../governance';
import { MarkdownSuspense } from '@hypha-platform/ui/server';
import { ButtonClose } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';

type ProposalDetailProps = ProposalHeadProps & {
  onAccept: () => void;
  onReject: () => void;
  onCheckProposalExpiration: () => void;
  isVoting?: boolean;
  content?: string;
  closeUrl: string;
  leadImage?: string;
  attachments?: string[];
  proposalId?: number | null | undefined;
  spaceSlug: string;
  label?: string;
  documentSlug: string;
  dbTokens?: DbToken[];
};

export const ProposalDetail = ({
  creator,
  title,
  commitment,
  status,
  isLoading,
  onAccept,
  onReject,
  onCheckProposalExpiration,
  content,
  closeUrl,
  leadImage,
  attachments,
  proposalId,
  spaceSlug,
  isVoting,
  label,
  documentSlug,
  dbTokens,
}: ProposalDetailProps) => {
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: proposalId as number,
  });
  const { isAuthenticated } = useAuthentication();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <ProposalHead
          creator={creator}
          title={title}
          commitment={commitment}
          status={status}
          isLoading={isLoading}
          label={label}
          createDate={formatDate(proposalDetails?.startTime ?? new Date())}
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
          initialSupply={token.maxSupply}
          dbTokens={dbTokens}
        />
      ))}
      {proposalDetails?.transfers.map((tx, idx) => (
        <ProposalTransactionItem
          key={idx}
          recipient={tx?.recipient}
          amount={tx?.rawAmount}
          tokenAddress={tx?.token}
          spaceSlug={spaceSlug}
        />
      ))}
      {proposalDetails?.mintings.map((mint, idx) => (
        <ProposalMintItem key={idx} member={mint.member} number={mint.number} />
      ))}
      <FormVoting
        unity={proposalDetails?.unityPercentage || 0}
        quorum={proposalDetails?.quorumPercentage || 0}
        endTime={formatISO(new Date(proposalDetails?.endTime || new Date()))}
        executed={proposalDetails?.executed}
        expired={proposalDetails?.expired}
        onAccept={onAccept}
        onReject={onReject}
        onCheckProposalExpiration={onCheckProposalExpiration}
        isLoading={isLoading}
        isVoting={isVoting}
        documentSlug={documentSlug}
        isAuthenticated={isAuthenticated}
      />
      {/* TODO: uncomment when comments support will be implemented */}
      {/* <Separator />
      <CommentsList
        pagination={{
          total: 0,
        }}
        comments={[]}
      /> */}
    </div>
  );
};
