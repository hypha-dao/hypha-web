'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../../common';
import { SpaceCard } from './space-card';
import { useRouter } from 'next/navigation';

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  showExitButton?: boolean;
};

export const SpaceCardContainer = ({
  lang,
  spaces,
  showExitButton,
}: SpaceCardContainerProps) => {
  const router = useRouter();
  return (
    <div
      data-testid="member-spaces-container"
      className="grid grid-cols-1 sm:grid-cols-3 gap-2"
    >
      {spaces.map((space) =>
        space.slug ? (
          <div key={space.id}>
            <div
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={`View agreements for ${space.title}`}
              onClick={() => {
                const path = getDhoPathAgreements(lang, space.slug);
                router.push(path);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  const path = getDhoPathAgreements(lang, space.slug);
                  router.push(path);
                }
              }}
            >
              <SpaceCard
                description={space.description || ''}
                icon={space.logoUrl || ''}
                leadImage={space.leadImage || ''}
                members={space.memberCount}
                agreements={space.documentCount}
                title={space.title || ''}
                isSandbox={space.flags?.includes('sandbox') ?? false}
                isDemo={space.flags?.includes('demo') ?? false}
                web3SpaceId={space.web3SpaceId as number}
                configPath={`${getDhoPathAgreements(
                  lang,
                  space.slug,
                )}/space-configuration`}
                createdAt={space.createdAt}
                showExitButton={showExitButton}
              />
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
};
