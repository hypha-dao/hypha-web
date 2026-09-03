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

/** Two complete rows in a 2-col rail, or two rows in a 3-col field. */
const FIELD_PEOPLE_LIMIT = 6;

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'P';
}

export function NetworkPeopleStrip({
  lang,
  people,
  layout = 'field',
  isLoading = false,
  error = false,
  onRetry,
}: {
  lang: Locale;
  people: NetworkPerson[];
  layout?: 'field' | 'rail';
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('Journey');
  if (people.length === 0 && !isLoading && !error && layout === 'rail')
    return null;

  const visiblePeople =
    layout === 'field' ? people.slice(0, FIELD_PEOPLE_LIMIT) : people;

  return (
    <Card className="craft-card shrink-0 overflow-visible @container/people">
      <CardContent className="flex flex-col gap-4 overflow-visible p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3">
          {layout === 'field' ? (
            <JourneyMark kind="circles" className="mt-0.5" />
          ) : (
            <span className="size-0" aria-hidden />
          )}
          <div className="min-w-0">
            <h2 className="whitespace-nowrap [font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('connectTitle')}
            </h2>
            <p className="mt-1 text-2 leading-snug text-muted-foreground">
              {t('connectLead')}
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            colorVariant="neutral"
            className="shrink-0 self-start"
          >
            <Link
              href={getNetworkConnectPath(lang)}
              className="whitespace-nowrap"
            >
              {t('connectSeeAll')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <p className="text-2 text-muted-foreground">{t('connectLoading')}</p>
        ) : error && people.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-2 text-muted-foreground">{t('connectError')}</p>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                onClick={onRetry}
                className="rounded-xl"
              >
                {t('connectRetry')}
              </Button>
            ) : null}
          </div>
        ) : visiblePeople.length > 0 ? (
          <ul
            className={cn(
              layout === 'field'
                ? 'grid grid-cols-2 gap-x-3 gap-y-4 @[22rem]/people:grid-cols-3'
                : 'flex flex-col gap-1',
            )}
          >
            {visiblePeople.map((person) => (
              <li key={person.slug} className="min-w-0">
                <Link
                  href={getNetworkConnectPath(lang, person.slug)}
                  className={cn(
                    'craft-row-interactive min-w-0 rounded-xl',
                    layout === 'field'
                      ? 'flex flex-col items-center gap-2 px-1 py-2 text-center'
                      : 'flex items-center gap-3 px-2 py-2',
                  )}
                >
                  <Avatar
                    className={cn(
                      'shrink-0 rounded-full',
                      layout === 'field' ? 'size-12' : 'size-10',
                    )}
                  >
                    <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="rounded-full text-2">
                      {initials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'min-w-0 text-2 leading-tight',
                      layout === 'field'
                        ? 'line-clamp-2 w-full'
                        : 'truncate max-w-[16ch]',
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
