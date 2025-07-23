'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { CategorySpaces } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';

export function NetworkAll({
  lang,
  spaces,
  categories,
}: {
  lang: Locale;
  spaces: Space[];
  categories: Category[];
}) {
  return (
    <>
      <Text className="text-9 text-center flex mb-8">
        Category Spaces
      </Text>
      {/* TODO: search input */}
      <CategorySpaces
        lang={lang}
        spaces={spaces}
        categories={categories}
      />
    </>
  );
}
