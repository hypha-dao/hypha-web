import { addDays } from 'date-fns';
import { formatISO } from 'date-fns';
import { FormVoting } from './form-voting';
import { ProposalHead, ProposalHeadProps } from './proposal-head';
import { Button, Separator } from '@hypha-platform/ui';
import { RxCross1 } from "react-icons/rx";


type ProposalDetailProps = ProposalHeadProps & {
  onAccept: () => void;
  onReject: () => void;
  content: string;
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
}: ProposalDetailProps) => {
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
        <Button variant="ghost" colorVariant="neutral">
          Close
          <RxCross1 />
        </Button>
      </div>
      <Separator />
      <div>
        {content}
      </div>
      <Separator />
      <FormVoting
        unity={50}
        quorum={25}
        date={formatISO(addDays(new Date(), 2))}
        onAccept={function (): void {
          throw new Error('Function not implemented.');
        }}
        onReject={function (): void {
          throw new Error('Function not implemented.');
        }}
      />
      <Separator />
    </div>
  );
};
