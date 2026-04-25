'use client';

import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';

type DocumentsSectionsProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
  order?: Order<Document>;
};

const INITIAL_VISIBLE = 6;
const LOAD_MORE_INCREMENT = 50;

export function DocumentsSections({
  lang,
  spaceSlug,
  web3SpaceId,
  order,
}: DocumentsSectionsProps) {
  const t = useTranslations('AgreementsTab');
  const { resolvedTheme } = useTheme();
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });

  const basePath = `/${lang}/dho/${spaceSlug}/agreements`;

  return (
    <div className="py-4" data-testid="agreements-tab-panels">
      <Tabs defaultValue="on-voting" className="w-full">
        <div
          className={cn(
            'sticky top-0 z-10 flex w-full justify-center border-b border-border/60 py-2 backdrop-blur-md',
            resolvedTheme === 'dark' ? 'bg-background/80' : 'bg-background/90',
          )}
          data-testid="agreements-section-tabs"
        >
          <TabsList triggerVariant="switch">
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
        </div>
        <TabsContent value="on-voting" className="mt-4 min-h-0 outline-none">
          <DocumentSection
            basePath={`${basePath}/proposal`}
            web3SpaceId={web3SpaceId}
            documents={documents.onVoting}
            label={t('onVoting')}
            hasSearch={true}
            isLoading={isLoading}
            firstPageSize={INITIAL_VISIBLE}
            pageSize={LOAD_MORE_INCREMENT}
          />
        </TabsContent>
        <TabsContent value="accepted" className="mt-4 min-h-0 outline-none">
          <DocumentSection
            basePath={`${basePath}/proposal`}
            web3SpaceId={web3SpaceId}
            documents={documents.accepted}
            label={t('accepted')}
            hasSearch={true}
            isLoading={isLoading}
            firstPageSize={INITIAL_VISIBLE}
            pageSize={LOAD_MORE_INCREMENT}
          />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4 min-h-0 outline-none">
          <DocumentSection
            basePath={`${basePath}/proposal`}
            web3SpaceId={web3SpaceId}
            documents={documents.rejected}
            label={t('refused')}
            hasSearch={true}
            isLoading={isLoading}
            firstPageSize={INITIAL_VISIBLE}
            pageSize={LOAD_MORE_INCREMENT}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
