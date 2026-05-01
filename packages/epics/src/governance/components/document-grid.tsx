import { type BadgeItem } from '@hypha-platform/ui';
import { type Creator } from '../../people/components/person-label';
import { DocumentCard } from './document-card';

interface Document {
  title?: string;
  description?: string;
  leadImage?: string;
  creator?: Creator;
  badges?: BadgeItem[];
  slug?: string;
  interactions?: React.ReactNode;
  createdAt?: Date;
}

interface DocumentGridProps {
  isLoading: boolean;
  basePath: string;
  documents: Document[];
}

export const DocumentGrid = ({
  isLoading = true,
  basePath,
  documents,
}: DocumentGridProps) => {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard
          key={document.slug}
          {...document}
          isLoading={isLoading}
          detailHref={
            document.slug ? `${basePath}/${document.slug}` : undefined
          }
        />
      ))}
    </div>
  );
};
