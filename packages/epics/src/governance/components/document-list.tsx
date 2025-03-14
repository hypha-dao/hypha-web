import { DocumentCard } from './document-card';
import { DocumentListCard } from './document-list-card';
import { UseDocuments } from '../../governance';
import Link from 'next/link';
import { cn } from '@hypha-platform/lib/utils';

interface DocumentListProps {
  page: number;
  basePath: string;
  useDocuments: UseDocuments;
  hasGridView: boolean;
}

interface GridLoadersProps {
  isLoading: boolean;
}

interface ListLoadersProps {
  isLoading: boolean;
}

export const DocumentList = ({
  page,
  basePath,
  useDocuments,
  hasGridView,
}: DocumentListProps) => {
  const { documents, isLoading } = useDocuments({
    page,
    filter: { state: '' },
  });

  const GridLoaders = ({ isLoading }: GridLoadersProps) => {
    return isLoading ? (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        <DocumentCard isLoading={isLoading} />
        <DocumentCard isLoading={isLoading} />
        <DocumentCard isLoading={isLoading} />
      </div>
    ) : null;
  };

  const ListLoaders = ({ isLoading }: ListLoadersProps) => {
    return isLoading ? (
      <div>
        <DocumentListCard isLoading={isLoading} />
        <DocumentListCard isLoading={isLoading} />
        <DocumentListCard isLoading={isLoading} />
      </div>
    ) : null;
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          hasGridView ? 'grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2' : '',
        )}
      >
        {documents.map((document) => (
          <Link
            href={`${basePath}/${document.slug}`}
            key={document.slug}
            scroll={false}
          >
            {hasGridView ? (
              <DocumentCard {...document} isLoading={isLoading} />
            ) : (
              <DocumentListCard {...document} isLoading={isLoading} />
            )}
          </Link>
        ))}
      </div>
      {hasGridView ? (
        <GridLoaders isLoading={isLoading} />
      ) : (
        <ListLoaders isLoading={isLoading} />
      )}
    </div>
  );
};
