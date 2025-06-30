'use client';
import { FC } from 'react';
import { AgreementsList } from './agreements-list';
import { Text } from '@radix-ui/themes';
import { useAgreementsSection } from '../hooks/use-agreements-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { UseDocuments } from '../../governance';
import { Empty } from '../../common';

type AgreementsSectionProps = {
  basePath: string;
  useDocuments: UseDocuments;
  hasAvatar?: boolean;
};

export const AgreementsSection: FC<AgreementsSectionProps> = ({
  basePath,
  useDocuments,
  hasAvatar = true,
}) => {
  const { pages, activeFilter, isLoading, loadMore, pagination } =
    useAgreementsSection({ useDocuments });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={pagination?.total || 0} label="Agreements" />

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <AgreementsList
            page={index + 1}
            key={index}
            activeFilter={activeFilter}
            basePath={basePath}
            useDocuments={useDocuments}
            hasAvatar={hasAvatar}
          />
        ))
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages
              ? 'No more agreements'
              : 'Load more agreements'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
