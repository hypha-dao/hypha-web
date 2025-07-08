'use client';

import { SpaceCardWrapper, UseMembers } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';

export const getDhoPathGovernance = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/governance`;
};

type SpaceCardContainerProps = {
  lang: Locale;
  pagination: {
    page: number;
    pageSize: number;
  };
  spaces: any[];
  useMembers: UseMembers;
};

export const SpaceCardContainer = ({
  lang,
  pagination,
  spaces,
  useMembers,
}: SpaceCardContainerProps) => {
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedDocuments = spaces.slice(
    Math.max(0, startIndex),
    Math.min(spaces.length, endIndex),
  );

  return (
    <div
      data-testid="member-spaces-container"
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
    >
      {paginatedDocuments.map((space) => (
        <div key={space.id}>
          <Link href={getDhoPathGovernance(lang, space.slug as string)}>
            <SpaceCardWrapper
              description={space.description as string}
              icon={space.logoUrl || ''}
              leadImage={space.leadImage || ''}
              agreements={space.documentCount}
              title={space.title as string}
              spaceSlug={space.slug as string}
              useMembers={useMembers}
            />
          </Link>
        </div>
      ))}
    </div>
  );
};
