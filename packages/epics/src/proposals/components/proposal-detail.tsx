import { formatISO } from 'date-fns';
import { FormVoting } from './form-voting';
import { ProposalHead, ProposalHeadProps } from './proposal-head';
import {
  Button,
  Separator,
  AttachmentList,
  Skeleton,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { CommentsList } from '../../interactions/components/comments-list';
import Link from 'next/link';
import Image from 'next/image';
import { useProposalDetailsWeb3Rpc } from '@core/governance';
import {
  ProposalTransactionItem,
  ProposalTokenItem,
  ProposalVotingInfo,
  ProposalMintItem,
} from '../../governance';
import { MarkdownSuspense } from '@hypha-platform/ui/server';

type ProposalDetailProps = ProposalHeadProps & {
  onAccept: () => void;
  onReject: () => void;
  updateProposalData: () => void;
  content?: string;
  closeUrl: string;
  leadImage?: string;
  attachments?: string[];
  proposalId?: number | null | undefined;
};

export const ProposalDetail = ({
  creator,
  title,
  commitment,
  status,
  isLoading,
  onAccept,
  onReject,
  content,
  closeUrl,
  leadImage,
  attachments,
  proposalId,
  updateProposalData,
}: ProposalDetailProps) => {
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: proposalId as number,
  });
  const handleOnAccept = () => {
    try {
      onAccept();
      updateProposalData();
    } catch (err) {
      console.debug(err);
    }
  };
  const handleOnReject = () => {
    try {
      onReject();
      updateProposalData();
    } catch (err) {
      console.debug(err);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <ProposalHead
          creator={creator}
          title={title}
          commitment={commitment}
          status={status}
          isLoading={isLoading}
        />
        <Link href={closeUrl} scroll={false}>
          <Button variant="ghost" colorVariant="neutral">
            Close
            <RxCross1 />
          </Button>
        </Link>
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
          src={leadImage ?? ''}
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
        />
      ))}
      {proposalDetails?.tokens.map((token, idx) => (
        <ProposalTokenItem
          key={idx}
          name={token.name}
          symbol={token.symbol}
          initialSupply={token.maxSupply}
        />
      ))}
      {proposalDetails?.transfers.map((tx, idx) => (
        <ProposalTransactionItem
          key={idx}
          recipient={tx?.recipient}
          amount={tx?.rawAmount}
          tokenAddress={tx?.token}
        />
      ))}
      {proposalDetails?.mintings.map((mint, idx) => (
        <ProposalMintItem key={idx} member={mint.member} number={mint.number} />
      ))}
      <FormVoting
        unity={proposalDetails?.yesVotePercentage || 0}
        quorum={proposalDetails?.quorumPercentage || 0}
        endTime={formatISO(new Date(proposalDetails?.endTime || new Date()))}
        onAccept={handleOnAccept}
        onReject={handleOnReject}
      />
      <Separator />
      <CommentsList
        pagination={{
          total: 0,
        }}
        comments={[]}
      />
    </div>
  );
};
