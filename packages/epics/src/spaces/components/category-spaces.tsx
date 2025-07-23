'use client';

import { Category, Space } from "@hypha-platform/core/client";
import { Locale } from "@hypha-platform/i18n";

function filterSpaces(
  spaces: Space[],
  categories: Category[],
) {
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
  // useMembers,
  categories,
}: {
  lang: Locale;
  spaces: Space[];
  // useMembers: UseMembers;
  categories: Category[];
}) {
  const categorySpaces = filterSpaces(spaces, categories);
  console.log('categorySpaces found:', categorySpaces.length);
  return (<></>);
}