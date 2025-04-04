import {
  Skeleton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@hypha-platform/ui';
import { Image } from '@hypha-platform/ui';
import { PersonLabel } from '../../people/components/person-label';
import { type Creator } from '../../people/components/person-label';
import { type BadgeItem, BadgesList } from '@hypha-platform/ui';
import { MarkdownSuspense } from '@hypha-platform/ui/server';

interface Document {
  title?: string;
  description?: string;
}

interface DocumentCardProps {
  isLoading: boolean;
  leadImage?: string;
  creator?: Creator;
  badges?: BadgeItem[];
  interactions?: React.ReactNode;
}

export const DocumentCard: React.FC<DocumentCardProps & Document> = ({
  title,
  description,
  isLoading,
  leadImage,
  creator,
  badges,
  interactions,
}) => {
  return (
    <Card className="h-full w-full space-y-5">
      <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
        <Skeleton
          loading={isLoading}
          className="min-w-full"
          height="150px"
          width="250px"
        >
          <Image
            className="rounded-tl-xl rounded-tr-xl object-cover w-full h-full"
            src={leadImage || '/placeholder/document-lead-image.png'}
            alt={title || ''}
            width={250}
            height={150}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <BadgesList isLoading={isLoading} badges={badges ?? []} />
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle>{title}</CardTitle>
          </Skeleton>
          <PersonLabel isLoading={isLoading} creator={creator} />
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
            loading={isLoading}
          >
            <div className="line-clamp-3 w-full">
              <MarkdownSuspense content={description || ''}/>
            </div>
          </Skeleton>
        </div>
        {interactions}
      </CardContent>
    </Card>
  );
};
