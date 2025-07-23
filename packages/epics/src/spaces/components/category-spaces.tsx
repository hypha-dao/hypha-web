'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';
import { SpaceCardWrapper } from './space-card.wrapper';
import { getDhoPathGovernance } from './space-card.container';
import { UseMembers } from '../hooks';
// import { UseMembers } from "../hooks";

function filterSpaces(spaces: Space[], categories: Category[]) {
  const categorySpaces: Space[] = spaces.filter((space) => {
    for (const category of categories) {
      if (space.categories.includes(category)) {
        return true;
      }
    }
    return false;
  });
  return categorySpaces;
}

export function CategorySpaces({
  lang,
  spaces,
  categories,
  useMembers,
}: {
  lang: Locale;
  spaces: Space[];
  categories: Category[];
  useMembers: UseMembers;
}) {
  const categorySpaces = filterSpaces(spaces, categories);
  console.log('categorySpaces found:', categorySpaces.length);
  return (
    <div
      data-testid="recommended-spaces-container"
      className="w-full space-y-6"
    >
      <Text className="text-4 font-medium">Spaces you might like</Text>
      <Carousel>
        <CarouselContent>
          {spaces.map((space) => (
            <CarouselItem
              key={space.id}
              className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
            >
              <Link
                className="flex flex-col flex-1"
                href={getDhoPathGovernance(lang, space.slug as string)}
              >
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
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
