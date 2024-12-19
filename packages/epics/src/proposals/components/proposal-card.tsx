import { Card, Button,  Skeleton } from '@hypha-platform/ui';
import { CreatorType, ProposalHead } from './proposal-head';



type ProposalCardProps = {
  creator?: CreatorType;
  title?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
};

const voted = false;

export const ProposalCard: React.FC<ProposalCardProps> = ({
  commitment,
  status,
  title,
  creator,
  isLoading,
}) => {
  return (
    <Card className="w-full h-full p-5 mb-2 flex items-center justify-between">
      <ProposalHead
        creator={creator}
        title={title}
        commitment={commitment}
        status={status}
        isLoading={isLoading}
      />
      <div>
        <Skeleton
          height="32px"
          width="86px"
          loading={isLoading}
          className="rounded-lg"
          >
            <div>
              {voted ? (
                <Button
                  className="rounded-lg w-fit"
                  variant="outline"
                  size="sm"
                >
                  You voted yes
                </Button>
              ) : (
                <Button
                  className="rounded-lg w-fit"
                  variant="outline"
                  size="sm"
                >
                  Vote now
                </Button>
              )}
            </div>
          </Skeleton>
        </div>
    </Card>
  );
};
