'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowRight } from 'lucide-react';
import { getNetworkConnectPath } from '../../common/get-path-function';
import type { NetworkPerson } from '../network-pulse';
import { JourneyMark } from './journey-mark';

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'P';
}

export function NetworkPeopleStrip({
  lang,
  people,
  layout = 'field',
  isLoading = false,
}: {
  lang: Locale;
  people: NetworkPerson[];
  layout?: 'field' | 'rail';
  isLoading?: boolean;
}) {
  const t = useTranslations('Journey');
  if (people.length === 0 && !isLoading && layout === 'rail') return null;

  return (
    <Card className="craft-card">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {layout === 'field' ? <JourneyMark kind="circles" /> : null}
            <div>
              <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                {t('connectTitle')}
              </h2>
              <p className="mt-1 text-2 text-muted-foreground">
                {t('connectLead')}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" colorVariant="neutral">
            <Link href={getNetworkConnectPath(lang)}>
              {t('connectSeeAll')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <p className="text-2 text-muted-foreground">{t('connectLoading')}</p>
        ) : people.length > 0 ? (
          <ul
            className={cn(
              layout === 'field'
                ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
                : 'flex flex-col gap-1',
            )}
          >
            {people.map((person) => (
              <li key={person.slug}>
                <Link
                  href={getNetworkConnectPath(lang, person.slug)}
                  className={cn(
                    'craft-row-interactive rounded-xl',
                    layout === 'field'
                      ? 'flex flex-col items-center gap-2 px-2 py-3 text-center'
                      : 'flex items-center gap-3 px-2 py-2',
                  )}
                >
                  <Avatar
                    className={cn(
                      'rounded-full',
                      layout === 'field' ? 'size-14' : 'size-10',
                    )}
                  >
                    <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="rounded-full text-2">
                      {initials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'truncate text-2',
                      layout === 'field' ? 'max-w-full' : 'max-w-[16ch]',
                    )}
                  >
                    {person.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2 text-muted-foreground">{t('connectEmpty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
