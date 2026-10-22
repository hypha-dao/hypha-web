'use client';

import { type BadgeItem } from '@hypha-platform/ui';
import { useCompactPanelsMode } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { type Creator } from '../../people/components/person-label';
import {
  useAiPanel,
  useHumanChatPanel,
} from '../../common/human-chat-panel-context';
import { DocumentCard } from './document-card';
import Link from 'next/link';

const DOCUMENT_GRID_CLASS =
  'grid w-full grid-cols-1 items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';
/** One breakpoint later while a docked panel is eating the column. */
const DOCUMENT_GRID_DOCKED_CLASS =
  'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3';

function useDockedSidePanel() {
  const { open: rightOpen } = useHumanChatPanel();
  const { open: leftOpen } = useAiPanel();
  const compact = useCompactPanelsMode();
  return (rightOpen || leftOpen) && !compact;
}

interface Document {
  title?: string;
  description?: string;
  leadImage?: string;
  creator?: Creator;
  badges?: BadgeItem[];
  slug?: string;
  interactions?: React.ReactNode;
  createdAt?: Date;
}

interface DocumentGridProps {
  isLoading: boolean;
  basePath: string;
  documents: Document[];
}

export const DocumentGrid = ({
  isLoading = true,
  basePath,
  documents,
}: DocumentGridProps) => {
  const dockedPanel = useDockedSidePanel();
  const gridClassName = cn(
    DOCUMENT_GRID_CLASS,
    dockedPanel && DOCUMENT_GRID_DOCKED_CLASS,
  );

  if (isLoading && documents.length === 0) {
    return (
      <div className={gridClassName}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`document-skeleton-${index}`} className="w-full min-h-0">
            <DocumentCard isLoading />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      {documents.map((document) => (
        <Link
          href={`${basePath}/${document.slug}`}
          key={document.slug}
          scroll={false}
          className="w-full min-h-0"
        >
          <DocumentCard {...document} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
};
