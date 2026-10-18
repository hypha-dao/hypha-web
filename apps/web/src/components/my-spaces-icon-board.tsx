'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  MyFilteredSpaces,
  resolveSpaceDisplayLogoUrl,
} from '@hypha-platform/epics';
import { Space, SpaceOrder } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';

import { EcosystemDiagram } from './ecosystem-diagram';

function SpaceIconGrid({ lang, spaces }: { lang: Locale; spaces: Space[] }) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <ul className="grid grid-cols-4 gap-3">
      {spaces.map((space) => {
        const icon = resolveSpaceDisplayLogoUrl(space, logoVariant);
        const initial = space.title.trim().charAt(0).toUpperCase();
        return (
          <li key={space.id} className="min-w-0">
            <Link
              href={`/${lang}/dho/${space.slug}/overview`}
              className="flex flex-col items-center gap-2 px-1 py-2 text-center hover:bg-accent-2"
            >
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-background-2">
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="text-3"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    {initial}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-1 leading-snug">
                {space.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Same ecosystem groups and diagram toggle as My Spaces, with round icons. */
export function MySpacesIconBoard({
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
      renderSpaces={(group) => <SpaceIconGrid lang={lang} spaces={group} />}
      renderDiagram={(root) =>
        root.slug ? <EcosystemDiagram spaceSlug={root.slug} /> : null
      }
    />
  );
}
