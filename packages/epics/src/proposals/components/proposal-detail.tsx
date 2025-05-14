import { addDays } from 'date-fns';
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
import { ProposalTransactionItem } from '../../governance';

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
      <div>{content}</div>
      <AttachmentList attachments={attachments || []} />
      {proposalDetails?.transfers.map((tx, idx) => (
        <ProposalTransactionItem
          key={idx}
          recipient={tx?.recipient}
          amount={tx?.rawAmount}
          tokenAddress={tx?.token}
        />
      ))}
      <FormVoting
        unity={proposalDetails?.yesVotePercentage || 0}
        quorum={proposalDetails?.quorumPercentage || 0}
        endTime={formatISO(
          addDays(new Date(proposalDetails?.endTime || new Date()), 2),
        )}
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
