import { Card, Skeleton, CardHeader, Image } from '@hypha-platform/ui';
import { CardCommentProps } from '../../interactions/components/card-comment';
import { GridAgreementView } from './grid-agreement-view';
import { RowAgreementView } from './row-agreement-view';

type Creator = {
  avatar?: string;
  name?: string;
  surname?: string;
};

export type AgreementCardProps = {
  creator?: Creator;
  title?: string;
  commitment?: number;
  status?: string;
  views?: number;
  comments?: CardCommentProps[];
  isLoading?: boolean;
  leadImage?: string;
  description?: string;
  gridView?: boolean;
};

export const AgreementCard = ({
  commitment,
  status,
  title,
  creator,
  views,
  comments,
  isLoading,
  leadImage,
  description,
  gridView = false,
}: AgreementCardProps) => {
  return (
    <Card className="h-full w-full">
      {gridView ? (
        <>
          <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
            <Skeleton loading={isLoading} height="150px" width="250px">
              <Image
                className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
                src={leadImage || '/placeholder/space-lead-image.png'}
                alt={title || 'TODO: make sure there is a title'}
                width={250}
                height={150}
              />
            </Skeleton>
          </CardHeader>
          <GridAgreementView
            commitment={commitment}
            status={status}
            title={title}
            creator={creator}
            views={views}
            comments={comments}
            isLoading={isLoading}
            description={description}
          />
        </>
      ) : (
        <RowAgreementView
          commitment={commitment}
          status={status}
          title={title}
          creator={creator}
          views={views}
          comments={comments}
          isLoading={isLoading}
        />
      )}
    </Card>
  );
};
