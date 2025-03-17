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
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 space-x-2 mb-2">
      {documents.map((document) => (
        <Link
          href={`${basePath}/${document.slug}`}
          key={document.slug}
          scroll={false}
        >
          <DocumentCard {...document} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
};
