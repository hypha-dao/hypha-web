'use client';

import {
  getDhoPathGovernance,
  InnerSpaceCardWrapper,
  SpaceCard,
  type UseMembers,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import {
  DEFAULT_SPACE_LEAD_IMAGE,
  type Space,
} from '@hypha-platform/core/client';

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  differentFirstCard?: boolean;
  currentSpaceId: number;
  useMembers: UseMembers;
};

export const InnerSpaceCardContainer = ({
  lang,
  spaces,
  differentFirstCard = false,
  currentSpaceId,
  useMembers,
}: SpaceCardContainerProps) => (
  <div
    data-testid="member-spaces-container"
    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
  >
    {spaces.map((space, index) =>
      space.slug ? (
        <div key={space.id}>
          <Link
            href={getDhoPathGovernance(lang, space.slug)}
            aria-label={`View governance for ${space.title}`}
          >
            {index === 0 && differentFirstCard ? (
              <SpaceCard
                description={space.description || ''}
                icon={space.logoUrl || ''}
                leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                members={space.memberCount}
                agreements={space.documentCount}
                title={space.title || ''}
                className={
                  space.id === currentSpaceId
                    ? 'border-2 border-action-light'
                    : undefined
                }
              />
            ) : (
              <InnerSpaceCardWrapper
                spaceSlug={space.slug}
                title={space.title}
                description={space.description || ''}
                leadImageUrl={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                useMembers={useMembers}
                parentTitle={space.parent?.title}
                className={
                  space.id === currentSpaceId
                    ? 'border-2 border-action-light'
                    : undefined
                }
              />
            )}
          </Link>
        </div>
      ) : null,
    )}
  </div>
);
