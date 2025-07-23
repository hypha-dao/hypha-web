'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { UseMembers } from '../hooks';
import { SpaceCardList } from './space-card-list';

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
    <div className="space-y-6">
      <SpaceCardList
        lang={lang}
        spaces={categorySpaces}
        useMembers={useMembers}
      />
    </div>
  );
}
