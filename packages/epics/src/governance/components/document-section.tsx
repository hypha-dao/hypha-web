'use client';
import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useDocumentsSection } from '../hooks/use-documents-section';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Document } from '@hypha-platform/core/client';
import { DocumentGridContainer } from './document-grid.container';
import { DirectionType } from '@hypha-platform/core/client';
import { Empty } from '../../common';
import { useTranslations } from 'next-intl';
import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';

type DocumentSectionProps = {
  basePath: string;
  web3SpaceId: number;
  spaceLeadImage?: string | null;
  documents: Document[];
  label?: string;
  headSectionButton?: React.ReactNode;
  hasSearch?: boolean;
  isLoading: boolean;
  error?: Error | unknown;
  firstPageSize?: number;
  pageSize?: number;
};

export const DocumentSection: FC<DocumentSectionProps> = ({
  basePath,
  web3SpaceId,
  spaceLeadImage,
  documents,
  label,
  headSectionButton,
  hasSearch = false,
  isLoading,
  error,
  firstPageSize = 3,
  pageSize = 3,
}) => {
  const tAgreements = useTranslations('AgreementsTab');
  const tCommon = useTranslations('Common');
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredDocuments,
  } = useDocumentsSection({
    documents,
    firstPageSize,
    pageSize,
  });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        {hasSearch ? (
          <Input
            type="search"
            placeholder={tAgreements('searchDocuments')}
            onChange={(event) => onUpdateSearch(event.target.value)}
            leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
            className="w-full"
          />
        ) : (
          <div className="w-full" />
        )}
        {headSectionButton ? (
          <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
            {headSectionButton}
          </div>
        ) : null}
      </div>

      {isLoading && pagination?.totalPages === 0 ? (
        <div className="w-full space-y-2">
          <DocumentGridContainer
            basePath={basePath}
            web3SpaceId={web3SpaceId}
            spaceLeadImage={spaceLeadImage}
            pagination={{
              page: 1,
              firstPageSize,
              pageSize,
              searchTerm,
              order: [
                {
                  dir: DirectionType.DESC,
                  name: 'createdAt',
                },
              ],
            }}
            documents={[]}
            isLoading
          />
        </div>
      ) : pagination?.totalPages === 0 ? (
        <Empty>
          <p>
            {error
              ? tAgreements('listFailedToLoad')
              : tAgreements('listIsEmpty')}
          </p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <DocumentGridContainer
              key={index}
              basePath={basePath}
              web3SpaceId={web3SpaceId}
              spaceLeadImage={spaceLeadImage}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'createdAt',
                  },
                ],
              }}
              documents={filteredDocuments}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages
              ? tCommon('noMore')
              : tCommon('loadMore')}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
