'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  Space,
} from '@hypha-platform/core/client';
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <JourneyMark kind="circles" />
          <div>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="craft-card overflow-hidden">
              <div className="journey-field h-24" />
              <div className="p-3 pt-8">
                <Skeleton loading className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : spaces.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                href={getDhoPathDefaultLanding(lang, space.slug as string)}
                className="craft-card-interactive relative flex flex-col overflow-hidden"
              >
                <div className="relative h-24 overflow-hidden">
                  <img
                    src={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex items-start gap-3 px-3.5 pb-3.5 pt-2">
                  <Avatar className="-mt-8 size-12 shrink-0 rounded-chrome border border-background-2">
                    <AvatarImage
                      src={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                      alt=""
                    />
                    <AvatarFallback className="rounded-chrome text-2">
                      {spaceInitial(space.title)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 pt-6">
                    <p className="truncate text-2 font-medium">{space.title}</p>
                    <p className="text-1 text-muted-foreground">
                      {space.memberCount ?? 0} {tCommon('Members')}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="craft-card flex flex-col items-start gap-3 p-5">
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
