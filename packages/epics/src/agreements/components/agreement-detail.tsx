import { AgreementHead, AgreementHeadProps } from './agreement-head';
import { Separator, Skeleton, AttachmentList } from '@hypha-platform/ui';
import { CommentsList } from '../../interactions/components/comments-list';
import { CardCommentProps } from '../../interactions/components/card-comment';
import Image from 'next/image';
import { ButtonClose } from '@hypha-platform/epics';

type AgreementDetailProps = AgreementHeadProps & {
  onSetActiveFilter: (value: string) => void;
  content: string;
  closeUrl: string;
  comments?: CardCommentProps[];
  leadImage?: string;
  attachments?: string[];
};

export const AgreementDetail = ({
  creator,
  title,
  commitment,
  status,
  isLoading,
  content,
  onSetActiveFilter,
  closeUrl,
  comments,
  leadImage,
  attachments,
}: AgreementDetailProps) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <AgreementHead
          creator={creator}
          title={title}
          commitment={commitment}
          status={status}
          isLoading={isLoading}
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
          src={leadImage ?? ''}
          alt={title ?? ''}
        />
      </Skeleton>
      <div>{content}</div>
      <AttachmentList attachments={attachments || []} />
      {/* TODO: uncomment when comments support will be implemented */}
      {/* <CommentsList
        pagination={{
          total: comments?.length ?? 0,
        }}
        comments={comments}
      /> */}
    </div>
  );
};
