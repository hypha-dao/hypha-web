'use client';

import { useState } from 'react';
import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { useFormatter, useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../../spaces/hooks/use-user-space-state';

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
  const format = useFormatter();
  const [activeTab, setActiveTab] = useState('on-voting');
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });
  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: web3SpaceId,
    spaceSlug,
  });
  const onVotingCount = documents.onVoting.length;
  const acceptedCount = documents.accepted.length;
  const rejectedCount = documents.rejected.length;

  const basePath = `/${lang}/dho/${spaceSlug}/agreements`;
  const createProposalPath = `${basePath}/select-create-action`;
  const canCreateProposal =
    !isUserStateLoading && userState === UserSpaceState.LOGGED_IN_SPACE;
  const createProposalButton = canCreateProposal ? (
    <Button asChild>
      <Link href={createProposalPath}>{t('newProposal')}</Link>
    </Button>
  ) : (
    <Button disabled>{t('newProposal')}</Button>
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col gap-4 py-0"
    >
      <TabsList triggerVariant="switch" className="w-fit">
        <TabsTrigger value="on-voting" variant="switch">
          <span className="inline-flex items-center gap-1">
            <span>{t('onVoting')}</span>
            <span className="text-xs text-muted-foreground">
              ({format.number(onVotingCount)})
            </span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="accepted" variant="switch">
          <span className="inline-flex items-center gap-1">
            <span>{t('accepted')}</span>
            <span className="text-xs text-muted-foreground">
              ({format.number(acceptedCount)})
            </span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="rejected" variant="switch">
          <span className="inline-flex items-center gap-1">
            <span>{t('rejected')}</span>
            <span className="text-xs text-muted-foreground">
              ({format.number(rejectedCount)})
            </span>
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="on-voting" className="mt-0">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.onVoting}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
      <TabsContent value="accepted" className="mt-0">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.accepted}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
      <TabsContent value="rejected" className="mt-0">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          documents={documents.rejected}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
    </Tabs>
  );
}
