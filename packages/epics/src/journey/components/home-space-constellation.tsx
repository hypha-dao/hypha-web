'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DEFAULT_SPACE_AVATAR_IMAGE, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Skeleton,
} from '@hypha-platform/ui';
import { CreateSpaceButton } from '../../spaces/components/create-space-button';
import { getDhoPathDefaultLanding } from '../../common/get-path-function';
import { JourneyMark } from './journey-mark';
import '../journey-surface.css';

function spaceInitial(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || 'S';
}

export function HomeSpaceConstellation({
  lang,
  spaces,
  isLoading,
  hiddenCount,
  isAuthenticated,
}: {
  lang: Locale;
  spaces: Space[];
  isLoading: boolean;
  hiddenCount: number;
  isAuthenticated: boolean;
}) {
  const t = useTranslations('Journey');
  const tCommon = useTranslations('Common');

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <JourneyMark kind="circles" />
          <div className="min-w-0">
            <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('spacesTitle')}
            </h2>
            <p className="mt-1 text-2 text-muted-foreground">
              {isLoading
                ? t('loading')
                : t('spacesCount', { count: spaces.length + hiddenCount })}
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" colorVariant="neutral">
          <Link href={`/${lang}/my-spaces`}>{t('viewAllSpaces')}</Link>
        </Button>
      </div>

      {isLoading ? (
        <ul className="-mx-1 flex gap-2 overflow-x-auto pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:pb-0">
          {[0, 1, 2].map((key) => (
            <li
              key={key}
              className="flex w-[13.5rem] shrink-0 items-center gap-3 rounded-xl px-2 py-2 xl:w-auto"
            >
              <Skeleton loading className="size-10 shrink-0 rounded-chrome" />
              <Skeleton loading className="h-4 w-24" />
            </li>
          ))}
        </ul>
      ) : spaces.length > 0 ? (
        <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:pb-0">
          {spaces.map((space) => (
            <li key={space.id} className="w-[13.5rem] shrink-0 xl:w-auto">
              <Link
                href={getDhoPathDefaultLanding(lang, space.slug as string)}
                className="craft-row-interactive flex items-center gap-3 rounded-xl px-2 py-2"
              >
                <Avatar className="size-10 shrink-0 rounded-chrome">
                  <AvatarImage
                    src={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                    alt=""
                  />
                  <AvatarFallback className="rounded-chrome text-2">
                    {spaceInitial(space.title)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-2 font-medium">{space.title}</p>
                  <p className="text-1 text-muted-foreground">
                    {space.memberCount ?? 0} {tCommon('Members')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="craft-card flex flex-col items-start gap-3 p-4">
          <p className="text-2 text-muted-foreground">{t('spacesEmpty')}</p>
          <p className="text-1 text-muted-foreground">{t('spacesEmptyHint')}</p>
          <CreateSpaceButton lang={lang} isAuthenticated={isAuthenticated} />
        </div>
      )}

      {hiddenCount > 0 ? (
        <Link
          href={`/${lang}/my-spaces`}
          className="text-1 text-muted-foreground hover:text-foreground"
        >
          {t('moreSpaces', { count: hiddenCount })}
        </Link>
      ) : null}
    </section>
  );
}
