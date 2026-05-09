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
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-2">
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
