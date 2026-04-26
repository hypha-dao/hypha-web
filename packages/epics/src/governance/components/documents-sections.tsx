'use client';

import * as React from 'react';
import { DocumentGridContainer } from './document-grid.container';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Text } from '@radix-ui/themes';
import { ChevronsRight } from 'lucide-react';
import { useDocumentsSection } from '../hooks/use-documents-section';
import { DirectionType } from '@hypha-platform/core/client';
import { Empty } from '../../common';

type DocumentsSectionsProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
  order?: Order<Document>;
};

const INITIAL_VISIBLE = 6;
const LOAD_MORE_INCREMENT = 50;

type AgreementTab = 'on-voting' | 'accepted' | 'rejected';

export function DocumentsSections({
  lang,
  spaceSlug,
  web3SpaceId,
  order,
}: DocumentsSectionsProps) {
  const t = useTranslations('AgreementsTab');
  const tCommon = useTranslations('Common');
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });

  const basePath = `/${lang}/dho/${spaceSlug}/agreements`;
  const proposalBasePath = `${basePath}/proposal`;

  const [tab, setTab] = React.useState<AgreementTab>('on-voting');

  const activeDocuments = React.useMemo(() => {
    if (tab === 'on-voting') return documents.onVoting;
    if (tab === 'accepted') return documents.accepted;
    return documents.rejected;
  }, [tab, documents.onVoting, documents.accepted, documents.rejected]);

  const { pages, loadMore, pagination, onUpdateSearch, filteredDocuments } =
    useDocumentsSection({
      documents: activeDocuments,
      firstPageSize: INITIAL_VISIBLE,
      pageSize: LOAD_MORE_INCREMENT,
    });

  const chevronMark = (
    <>
      <ChevronsRight className="h-4 w-4" aria-hidden />
      <ChevronsRight className="-ml-2.5 h-4 w-4" aria-hidden />
    </>
  );

  return (
    <div
      className="flex flex-col gap-4 py-4"
      data-testid="agreements-tab-panels"
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as AgreementTab)}
        className="w-full min-w-0"
      >
        <div
          className="flex w-full min-w-0 flex-col gap-3"
          data-testid="agreements-section-toolbar"
        >
          <SectionFilter
            count={pagination?.total ?? 0}
            label={tCommon('Agreements')}
            hasSearch
            searchPlaceholder={t('searchDocuments')}
            onChangeSearch={onUpdateSearch}
            leadingSlot={chevronMark}
            className="min-w-0 flex-wrap justify-end gap-2 sm:flex-nowrap sm:justify-end"
          >
            <TabsList
              triggerVariant="switch"
              className="w-full shrink-0 justify-center sm:w-auto"
              data-testid="agreements-section-tabs"
            >
              <TabsTrigger variant="switch" value="on-voting">
                {t('onVoting')}
              </TabsTrigger>
              <TabsTrigger variant="switch" value="accepted">
                {t('accepted')}
              </TabsTrigger>
              <TabsTrigger variant="switch" value="rejected">
                {t('refused')}
              </TabsTrigger>
            </TabsList>
          </SectionFilter>
        </div>

        {pagination?.totalPages === 0 ? (
          <Empty>
            <p>{t('listIsEmpty')}</p>
          </Empty>
        ) : (
          <div className="w-full space-y-2">
            {Array.from({ length: pages }).map((_, index) => (
              <DocumentGridContainer
                key={`${tab}-${index}`}
                basePath={proposalBasePath}
                web3SpaceId={web3SpaceId}
                pagination={{
                  page: index + 1,
                  firstPageSize: INITIAL_VISIBLE,
                  pageSize: LOAD_MORE_INCREMENT,
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
      </Tabs>
    </div>
  );
}
