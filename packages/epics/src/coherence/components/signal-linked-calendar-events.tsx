'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useScheduledItemsByCoherenceId,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { SpaceAccentSpinner } from '../../common/space-accent-loader';

type SignalLinkedCalendarEventsProps = {
  spaceSlug: string;
  coherenceId: number;
  lang: string;
  calendarPath: string;
  scheduleFromSignalPath: string;
};

function LinkedEventRow({
  item,
  lang,
  spaceSlug,
}: {
  item: ScheduledItem;
  lang: string;
  spaceSlug: string;
}) {
  const t = useTranslations('Calendar');
  const editHref = `/${lang}/dho/${spaceSlug}/calendar/edit-scheduled-item/${item.id}`;
  const startsAt =
    item.startsAt instanceof Date ? item.startsAt : new Date(item.startsAt);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(startsAt, 'PPp')} · {t(`type_${item.type}`)}
        </p>
      </div>
      <Button
        asChild
        type="button"
        variant="outline"
        colorVariant="neutral"
        size="sm"
      >
        <Link href={editHref} scroll={false}>
          {t('linkedEventOpen')}
        </Link>
      </Button>
    </li>
  );
}

export function SignalLinkedCalendarEvents({
  spaceSlug,
  coherenceId,
  lang,
  calendarPath,
  scheduleFromSignalPath,
}: SignalLinkedCalendarEventsProps) {
  const t = useTranslations('CoherenceTab');
  const { linkedEvents, isLoading } = useScheduledItemsByCoherenceId({
    spaceSlug,
    coherenceId,
  });

  return (
    <section className="rounded-xl border border-border/70 bg-muted/15 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/10 lg:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('linkedCalendarEventsTitle')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('linkedCalendarEventsHint')}
          </p>
        </div>
        <Button
          asChild
          type="button"
          variant="outline"
          colorVariant="neutral"
          size="sm"
        >
          <Link href={scheduleFromSignalPath} scroll={false}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {t('scheduleOnCalendar')}
          </Link>
        </Button>
      </div>

      {isLoading && !linkedEvents ? (
        <div
          className="flex items-center gap-2.5 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <SpaceAccentSpinner size="sm" />
          {t('linkedCalendarEventsLoading')}
        </div>
      ) : linkedEvents && linkedEvents.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {linkedEvents.map((item) => (
            <LinkedEventRow
              key={item.id}
              item={item}
              lang={lang}
              spaceSlug={spaceSlug}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('linkedCalendarEventsEmpty')}{' '}
          <Link
            href={calendarPath}
            className="font-medium text-foreground underline-offset-4 hover:underline"
            scroll={false}
          >
            {t('linkedCalendarEventsOpenCalendar')}
          </Link>
        </p>
      )}
    </section>
  );
}
