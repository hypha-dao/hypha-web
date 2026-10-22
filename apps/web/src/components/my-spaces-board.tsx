'use client';

import { MyFilteredSpaces } from '@hypha-platform/epics';
import { Space, SpaceOrder } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';

import { EcosystemDiagram } from './ecosystem-diagram';

export function MySpacesBoard({
  lang,
  spaces,
  order,
  query,
}: {
  lang: Locale;
  spaces: Space[];
  order?: SpaceOrder;
  query?: string;
}) {
  return (
    <MyFilteredSpaces
      lang={lang}
      spaces={spaces}
      order={order}
      query={query}
      renderDiagram={(root) =>
        root.slug ? <EcosystemDiagram spaceSlug={root.slug} /> : null
      }
    />
  );
}
