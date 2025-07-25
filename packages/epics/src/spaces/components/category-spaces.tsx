'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { UseMembers } from '../hooks';
import { SpaceCardList } from './space-card-list';

function filterSpaces(spaces: Space[], categories: Category[]) {
  return spaces.filter((space) =>
    categories.some((category) => space.categories.includes(category)),
  );
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
