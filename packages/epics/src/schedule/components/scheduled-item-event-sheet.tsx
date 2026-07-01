'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { CalendarClock, Pencil } from 'lucide-react';
import type { ScheduledItem } from '@hypha-platform/core/client';
import { isJoinableScheduledItem } from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { ScheduledItemMeetingActions } from './scheduled-item-meeting-actions';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

type ScheduledItemEventSheetProps = {
  item: ScheduledItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  lang?: string;
  onEdit: (item: ScheduledItem) => void;
};

export function ScheduledItemEventSheet({
  item,
  open,
  onOpenChange,
  spaceSlug,
  lang = 'en',
  onEdit,
}: ScheduledItemEventSheetProps) {
  const t = useTranslations('Calendar');
  const dateFnsLocale = React.useMemo(() => resolveDateFnsLocale(lang), [lang]);

  if (!item) return null;

  const whenLabel = item.allDay
    ? format(item.startsAt, 'PPP', { locale: dateFnsLocale })
    : `${format(item.startsAt, 'PPP p', { locale: dateFnsLocale })} – ${format(
        item.endsAt,
        'p',
        { locale: dateFnsLocale },
      )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-2 border-b border-border/60 px-5 py-4 text-left">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent-11">
            <CalendarClock className="size-3.5" aria-hidden />
            {t(`type_${item.type}` as 'type_call')}
          </div>
          <DialogTitle className="text-xl leading-tight">{item.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {whenLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-4">
          {isJoinableScheduledItem(item) ? (
            <ScheduledItemMeetingActions
              item={item}
              spaceSlug={spaceSlug}
              lang={lang}
              compact
            />
          ) : null}

          {item.location ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('fieldLocation')}
              </p>
              <p className="text-sm text-foreground">{item.location}</p>
            </div>
          ) : null}

          {item.description ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('fieldDescription')}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {item.description}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {t('invitationSentHint')}
          </p>
        </div>

        <DialogFooter className="border-t border-border/60 px-5 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onEdit(item);
            }}
          >
            <Pencil className="size-4" />
            {t('editDetails')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
