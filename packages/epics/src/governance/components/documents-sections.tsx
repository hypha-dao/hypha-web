'use client';

import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';

type DocumentsSectionsProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
};

export function DocumentsSections({
  lang,
  spaceSlug,
  web3SpaceId,
}: DocumentsSectionsProps) {
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
  });

  const basePath = `/${lang}/dho/${spaceSlug}/governance`;

  return (
    <div className="flex flex-col gap-6 py-4">
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.onVoting}
        label="On Voting"
        hasSearch={true}
        isLoading={isLoading}
      />
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.accepted}
        label="Accepted"
        hasSearch={true}
        isLoading={isLoading}
      />
      <DocumentSection
        basePath={`${basePath}/proposal`}
        documents={documents.rejected}
        label="Rejected"
        hasSearch={true}
        isLoading={isLoading}
      />
    </div>
  );
}
