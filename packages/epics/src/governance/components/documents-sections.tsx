'use client';

import { DocumentSection } from './document-section';
import { useSpaceDocumentsWithStatuses } from '../hooks/use-space-documents-with-statuses';
import { Document, Order } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';

type DocumentsSectionsProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
  order?: Order<Document>;
  createProposalPath?: string;
};

export function DocumentsSections({
  lang,
  spaceSlug,
  web3SpaceId,
  order,
  createProposalPath,
}: DocumentsSectionsProps) {
  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceId: web3SpaceId,
    spaceSlug,
    order,
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
        headSectionButton={
          createProposalPath && (
            <Button asChild colorVariant="accent">
              <Link href={createProposalPath}>
                <PlusIcon />
                Create Proposal
              </Link>
            </Button>
          )
        }
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
