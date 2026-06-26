'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import {
  RECURRENCE_PRESETS,
  REMINDER_MINUTES_OPTIONS,
  detectRecurrencePreset,
  type RecurrencePreset,
  SCHEDULED_ITEM_TYPES,
  type ScheduledItem,
  type ScheduledItemType,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Trash2 } from 'lucide-react';

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): Date {
  return new Date(value);
}

const TYPE_EMOJI: Record<ScheduledItemType, string> = {
  call: '📞',
  event: '📅',
  meeting: '👥',
  deadline: '⏰',
  reminder: '🔔',
};

export type ScheduledItemFormValues = {
  title: string;
  description?: string | null;
  type: ScheduledItemType;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location?: string | null;
  meetingUrl?: string | null;
  recurrencePreset?: RecurrencePreset;
  recurrenceUntil?: Date | null;
  matrixAutoLink?: boolean;
  remindEmail?: boolean;
  remindPush?: boolean;
  reminderMinutesBefore?: number | null;
};

export type ScheduledItemFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialItem?: ScheduledItem | null;
  draftRange?: {
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
  } | null;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  onSubmit: (values: ScheduledItemFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function ScheduledItemFormDialog({
  open,
  onOpenChange,
  mode,
  initialItem,
  draftRange,
  isSubmitting,
  isDeleting,
  onSubmit,
  onDelete,
}: ScheduledItemFormDialogProps) {
  const t = useTranslations('Calendar');

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<ScheduledItemType>('event');
  const [startsAtLocal, setStartsAtLocal] = React.useState('');
  const [endsAtLocal, setEndsAtLocal] = React.useState('');
  const [allDay, setAllDay] = React.useState(false);
  const [location, setLocation] = React.useState('');
  const [meetingUrl, setMeetingUrl] = React.useState('');
  const [recurrencePreset, setRecurrencePreset] =
    React.useState<RecurrencePreset>('none');
  const [recurrenceUntilLocal, setRecurrenceUntilLocal] = React.useState('');
  const [matrixAutoLink, setMatrixAutoLink] = React.useState(false);
  const [remindEmail, setRemindEmail] = React.useState(false);
  const [remindPush, setRemindPush] = React.useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = React.useState<
    number | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const resetExtendedFields = React.useCallback(() => {
    setRecurrencePreset('none');
    setRecurrenceUntilLocal('');
    setMatrixAutoLink(false);
    setRemindEmail(false);
    setRemindPush(false);
    setReminderMinutesBefore(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && initialItem) {
      setTitle(initialItem.title);
      setDescription(initialItem.description ?? '');
      setType(initialItem.type);
      setStartsAtLocal(toDatetimeLocalValue(initialItem.startsAt));
      setEndsAtLocal(toDatetimeLocalValue(initialItem.endsAt));
      setAllDay(initialItem.allDay);
      setLocation(initialItem.location ?? '');
      setMeetingUrl(initialItem.meetingUrl ?? '');
      setRecurrencePreset(detectRecurrencePreset(initialItem.recurrenceRule));
      setRecurrenceUntilLocal(
        initialItem.recurrenceUntil
          ? toDatetimeLocalValue(initialItem.recurrenceUntil).slice(0, 10)
          : '',
      );
      setMatrixAutoLink(initialItem.matrixAutoLink);
      setRemindEmail(initialItem.remindEmail);
      setRemindPush(initialItem.remindPush);
      setReminderMinutesBefore(initialItem.reminderMinutesBefore);
    } else if (draftRange) {
      setTitle('');
      setDescription('');
      setType('event');
      setStartsAtLocal(toDatetimeLocalValue(draftRange.startsAt));
      setEndsAtLocal(toDatetimeLocalValue(draftRange.endsAt));
      setAllDay(draftRange.allDay);
      setLocation('');
      setMeetingUrl('');
      resetExtendedFields();
    }
    setError(null);
  }, [open, mode, initialItem, draftRange, resetExtendedFields]);

  React.useEffect(() => {
    if ((type === 'call' || type === 'meeting') && mode === 'create' && open) {
      setMatrixAutoLink(true);
    }
  }, [type, mode, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('validationTitleRequired'));
      return;
    }

    const startsAt = fromDatetimeLocalValue(startsAtLocal);
    const endsAt = fromDatetimeLocalValue(endsAtLocal);
    if (endsAt.getTime() < startsAt.getTime()) {
      setError(t('validationEndAfterStart'));
      return;
    }

    if ((remindEmail || remindPush) && reminderMinutesBefore == null) {
      setError(t('validationReminderRequired'));
      return;
    }

    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        type,
        startsAt,
        endsAt,
        allDay,
        location: location.trim() || null,
        meetingUrl: matrixAutoLink ? null : meetingUrl.trim() || null,
        recurrencePreset,
        recurrenceUntil:
          recurrencePreset !== 'none' && recurrenceUntilLocal
            ? fromDatetimeLocalValue(`${recurrenceUntilLocal}T23:59`)
            : null,
        matrixAutoLink,
        remindEmail,
        remindPush,
        reminderMinutesBefore:
          remindEmail || remindPush ? reminderMinutesBefore : null,
      });
    } catch {
      setError(t('saveFailed'));
    }
  };

  const showCallFields = type === 'call' || type === 'meeting';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('createTitle') : t('editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('createDescription') : t('editDescription')}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled-item-title">{t('fieldTitle')}</Label>
            <Input
              id="scheduled-item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('fieldTitlePlaceholder')}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('fieldType')}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SCHEDULED_ITEM_TYPES.map((itemType) => (
                <button
                  key={itemType}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    type === itemType
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                  onClick={() => setType(itemType)}
                >
                  <span aria-hidden>{TYPE_EMOJI[itemType]}</span>
                  <span>{t(`type_${itemType}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <div>
              <Label htmlFor="scheduled-item-all-day">{t('fieldAllDay')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('fieldAllDayHint')}
              </p>
            </div>
            <Switch
              id="scheduled-item-all-day"
              checked={allDay}
              onCheckedChange={(checked) => {
                setAllDay(checked);
                if (!checked) return;
                if (startsAtLocal) {
                  setStartsAtLocal(`${startsAtLocal.slice(0, 10)}T00:00`);
                }
                const endDate = (endsAtLocal || startsAtLocal).slice(0, 10);
                if (endDate) {
                  setEndsAtLocal(`${endDate}T23:59`);
                }
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled-item-starts">{t('fieldStarts')}</Label>
              <Input
                id="scheduled-item-starts"
                type={allDay ? 'date' : 'datetime-local'}
                value={
                  allDay && startsAtLocal
                    ? startsAtLocal.slice(0, 10)
                    : startsAtLocal
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (allDay) {
                    setStartsAtLocal(`${value}T00:00`);
                  } else {
                    setStartsAtLocal(value);
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled-item-ends">{t('fieldEnds')}</Label>
              <Input
                id="scheduled-item-ends"
                type={allDay ? 'date' : 'datetime-local'}
                value={
                  allDay && endsAtLocal ? endsAtLocal.slice(0, 10) : endsAtLocal
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (allDay) {
                    setEndsAtLocal(`${value}T23:59`);
                  } else {
                    setEndsAtLocal(value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t('fieldRecurrence')}</Label>
              <Select
                value={recurrencePreset}
                onValueChange={(value) =>
                  setRecurrencePreset(value as RecurrencePreset)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('fieldRecurrenceNone')} />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {t(`recurrence_${preset}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrencePreset !== 'none' ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="scheduled-item-recurrence-until">
                  {t('fieldRecurrenceUntil')}
                </Label>
                <Input
                  id="scheduled-item-recurrence-until"
                  type="date"
                  value={recurrenceUntilLocal}
                  onChange={(e) => setRecurrenceUntilLocal(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {showCallFields ? (
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <Label htmlFor="scheduled-item-matrix-auto-link">
                  {t('fieldMatrixAutoLink')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('fieldMatrixAutoLinkHint')}
                </p>
              </div>
              <Switch
                id="scheduled-item-matrix-auto-link"
                checked={matrixAutoLink}
                onCheckedChange={setMatrixAutoLink}
              />
            </div>
          ) : null}

          {showCallFields && !matrixAutoLink ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled-item-meeting-url">
                {t('fieldMeetingUrl')}
              </Label>
              <Input
                id="scheduled-item-meeting-url"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder={t('fieldMeetingUrlPlaceholder')}
              />
            </div>
          ) : null}

          {showCallFields && matrixAutoLink && initialItem?.meetingUrl ? (
            <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {t('matrixLinkPreview', { url: initialItem.meetingUrl })}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled-item-location">
              {t('fieldLocation')}
            </Label>
            <Input
              id="scheduled-item-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('fieldLocationPlaceholder')}
            />
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-3 text-sm font-medium">{t('fieldReminders')}</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="scheduled-item-remind-email">
                  {t('fieldRemindEmail')}
                </Label>
                <Switch
                  id="scheduled-item-remind-email"
                  checked={remindEmail}
                  onCheckedChange={setRemindEmail}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="scheduled-item-remind-push">
                  {t('fieldRemindPush')}
                </Label>
                <Switch
                  id="scheduled-item-remind-push"
                  checked={remindPush}
                  onCheckedChange={setRemindPush}
                />
              </div>
              {remindEmail || remindPush ? (
                <div className="flex flex-col gap-2">
                  <Label>{t('fieldReminderMinutesBefore')}</Label>
                  <Select
                    value={
                      reminderMinutesBefore != null
                        ? String(reminderMinutesBefore)
                        : ''
                    }
                    onValueChange={(value) =>
                      setReminderMinutesBefore(Number.parseInt(value, 10))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('fieldReminderPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_MINUTES_OPTIONS.map((minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {t(`reminderMinutes_${minutes}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled-item-description">
              {t('fieldDescription')}
            </Label>
            <Textarea
              id="scheduled-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('fieldDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          {initialItem ? (
            <p className="text-xs text-muted-foreground">
              {t('createdAt', {
                date: format(initialItem.createdAt, 'PPp'),
              })}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {mode === 'edit' && onDelete ? (
              <Button
                type="button"
                variant="outline"
                colorVariant="error"
                disabled={isSubmitting || isDeleting}
                onClick={() => void onDelete()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? t('deleting') : t('delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? t('saving') : t('save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
