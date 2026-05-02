'use client';

import { useState } from 'react';
import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';

type DocumentsSectionsProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
  order?: Order<Document>;
};

export function DocumentsSections({
  lang,
  spaceSlug,
  web3SpaceId,
  order,
}: DocumentsSectionsProps) {
  const t = useTranslations('AgreementsTab');
  const [activeTab, setActiveTab] = useState('on-voting');
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });

  const basePath = `/${lang}/dho/${spaceSlug}/agreements`;
  const createProposalPath = `${basePath}/select-create-action`;
  const createProposalButton = (
    <Button asChild>
      <Link href={createProposalPath}>New Proposal</Link>
    </Button>
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col gap-4 py-0"
    >
      <TabsList triggerVariant="switch" className="w-fit">
        <TabsTrigger value="on-voting" variant="switch">
          {t('onVoting')}
        </TabsTrigger>
        <TabsTrigger value="accepted" variant="switch">
          {t('accepted')}
        </TabsTrigger>
        <TabsTrigger value="rejected" variant="switch">
          {t('rejected')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="on-voting">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.onVoting}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={9}
          pageSize={15}
        />
      </TabsContent>
      <TabsContent value="accepted">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.accepted}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={3}
          pageSize={15}
        />
      </TabsContent>
      <TabsContent value="rejected">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.rejected}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={3}
          pageSize={15}
        />
      </TabsContent>
    </Tabs>
  );
}
