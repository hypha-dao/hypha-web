'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { DocumentGridContainer } from './document-grid.container';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { useTranslations } from 'next-intl';
import { Button, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Text } from '@radix-ui/themes';
import { useDocumentsSection } from '../hooks/use-documents-section';
import { DirectionType } from '@hypha-platform/core/client';
import { useSpaceMember } from '../../spaces/hooks/use-space-member';
import { cleanPath } from '../../spaces/utils/cleanPath';
import {
  Empty,
  DhoTabListStack,
  DhoTabPage,
  DhoTabToolbarStack,
} from '../../common';

/** Parallel-route segment for the create (proposal) chooser; matches `apps/web` @web/app/constants. */
const PATH_SELECT_CREATE_ACTION = '/select-create-action' as const;

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
  const tDho = useTranslations('DHO');
  const pathname = usePathname();
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId });

  const createDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const createTooltip = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';
  const createHref = !createDisabled
    ? `${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`
    : '';
  const createLabel = tDho('actionButtons.createProposal');

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

  return (
    <DhoTabPage data-testid="agreements-tab-panels">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as AgreementTab)}
        className="w-full min-w-0"
      >
        <DhoTabToolbarStack data-testid="agreements-section-toolbar">
          <SectionFilter
            count={pagination?.total ?? 0}
            label={tCommon('Agreements')}
            hasSearch
            searchPlaceholder={t('searchDocuments')}
            onChangeSearch={onUpdateSearch}
            className="min-w-0 flex-wrap justify-end gap-2 sm:flex-nowrap sm:justify-end"
          >
            {createDisabled || !createHref ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                colorVariant="accent"
                disabled
                title={createTooltip || createLabel}
                aria-label={createLabel}
                data-testid="agreements-section-create"
              >
                <Plus
                  className="h-[1.125rem] w-[1.125rem]"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Button>
            ) : (
              <Button
                asChild
                size="icon"
                variant="outline"
                colorVariant="accent"
                data-testid="agreements-section-create"
              >
                <Link
                  href={createHref}
                  scroll={false}
                  title={createLabel}
                  aria-label={createLabel}
                >
                  <Plus
                    className="h-[1.125rem] w-[1.125rem]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </Link>
              </Button>
            )}
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
        </DhoTabToolbarStack>

        {pagination?.totalPages === 0 ? (
          <Empty>
            <p>{t('listIsEmpty')}</p>
          </Empty>
        ) : (
          <DhoTabListStack>
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
          </DhoTabListStack>
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
    </DhoTabPage>
  );
}
