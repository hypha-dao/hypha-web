import {
  findSpaceById,
  getSpaceAncestorChain,
} from '@hypha-platform/core/server';
import { SpaceBreadcrumb, SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { Locale } from '@hypha-platform/i18n';

export async function Breadcrumbs({
  spaceId,
  lang,
}: {
  spaceId: number;
  lang: Locale;
}) {
  const [chain, current] = await Promise.all([
    getSpaceAncestorChain({ leafSpaceId: spaceId }, { db }),
    findSpaceById({ id: spaceId }, { db }),
  ]);
  const segments = chain.length > 0 ? chain : current ? [current] : [];

  if (segments.length === 0) {
    return <SpaceBreadcrumb showRoot={false} />;
  }

  return (
    <SpaceBreadcrumb showRoot={false}>
      {segments.map((s, index) => (
        <SpaceBreadcrumbItem
          key={s.id}
          lang={lang}
          showSeparator={index > 0}
          breadcrumb={{ slug: s.slug, title: s.title }}
        />
      ))}
    </SpaceBreadcrumb>
  );
}
