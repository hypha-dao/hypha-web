'use client';

import { useEffect, useState } from 'react';
import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order, useSpaceBySlug } from '@hypha-platform/core/client';
import { useFormatter, useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../../spaces/hooks/use-user-space-state.web3.rpc';

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
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  const { documents, isLoading, error } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });
  const { space } = useSpaceBySlug(spaceSlug);
  const spaceLeadImage = space?.leadImage ?? null;
  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: web3SpaceId,
    spaceSlug,
  });
  const onVotingCount = documents.onVoting.length;
  const acceptedCount = documents.accepted.length;
  const rejectedCount = documents.rejected.length;

  // Header "Agreements | N" counts accepted on-chain proposals. Prefer the
  // Accepted tab when On Voting is empty so that count isn't paired with an
  // empty default list.
  useEffect(() => {
    if (isLoading || hasUserSelectedTab) return;
    if (onVotingCount === 0 && acceptedCount > 0) {
      setActiveTab('accepted');
    }
  }, [isLoading, hasUserSelectedTab, onVotingCount, acceptedCount]);

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
      onValueChange={(value) => {
        setHasUserSelectedTab(true);
        setActiveTab(value);
      }}
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
          spaceLeadImage={spaceLeadImage}
          documents={documents.onVoting}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          error={error}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
      <TabsContent value="accepted" className="mt-0">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          spaceLeadImage={spaceLeadImage}
          documents={documents.accepted}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          error={error}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
      <TabsContent value="rejected" className="mt-0">
        <DocumentSection
          basePath={`${basePath}/proposal`}
          web3SpaceId={web3SpaceId}
          spaceLeadImage={spaceLeadImage}
          documents={documents.rejected}
          headSectionButton={createProposalButton}
          hasSearch={true}
          isLoading={isLoading}
          error={error}
          firstPageSize={12}
          pageSize={12}
        />
      </TabsContent>
    </Tabs>
  );
}
