'use client';

import { type BadgeItem } from '@hypha-platform/ui';
import { type Creator } from '../../people/components/person-label';
import { DocumentCard } from './document-card';
import Link from 'next/link';
import { useScrollParallax } from '../../common/use-scroll-parallax';

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
  const { reduceMotion, parallaxY } = useScrollParallax({
    rate: 0.12,
    maxShiftPx: 18,
  });

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
      {documents.map((document) => (
        <Link
          href={`${basePath}/${document.slug}`}
          key={document.slug}
          scroll={false}
        >
          <DocumentCard
            {...document}
            isLoading={isLoading}
            parallaxY={parallaxY}
            reduceMotion={reduceMotion}
          />
        </Link>
      ))}
    </div>
  );
};
