'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
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
}: {
  lang: Locale;
  spaces: Space[];
  categories: Category[];
}) {
  const categorySpaces = filterSpaces(spaces, categories);

  return (
    <div className="space-y-6">
      <SpaceCardList lang={lang} spaces={categorySpaces} />
    </div>
  );
}
