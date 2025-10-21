'use client';

import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';

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
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
  });

  const basePath = `/${lang}/dho/${spaceSlug}/agreements`;

  return (
    <div className="flex flex-col gap-6 py-4">
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.onVoting}
        label="On Voting"
        hasSearch={true}
        isLoading={isLoading}
        firstPageSize={9}
        pageSize={15}
      />
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.accepted}
        label="Accepted"
        hasSearch={true}
        isLoading={isLoading}
        firstPageSize={3}
        pageSize={15}
      />
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.rejected}
        label="Rejected"
        hasSearch={true}
        isLoading={isLoading}
        firstPageSize={3}
        pageSize={15}
      />
    </div>
  );
}
