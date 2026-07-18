import { type BadgeItem } from '@hypha-platform/ui';
import { type Creator } from '../../people/components/person-label';
import { DocumentCard } from './document-card';
import Link from 'next/link';

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
  if (isLoading && documents.length === 0) {
    return (
      <div className="grid w-full grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`document-skeleton-${index}`} className="w-full min-h-0">
            <DocumentCard isLoading />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => (
        <Link
          href={`${basePath}/${document.slug}`}
          key={document.slug}
          scroll={false}
          className="w-full min-h-0"
        >
          <DocumentCard {...document} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
};
