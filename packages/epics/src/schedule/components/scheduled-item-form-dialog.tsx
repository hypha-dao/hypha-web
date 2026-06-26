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

const DATETIME_LOCAL_STEP_SECONDS = 900;
const DEFAULT_TIMED_DURATION_MS = 60 * 60 * 1000;
const MIN_TIMED_DURATION_MS = 15 * 60 * 1000;

function snapMinuteToQuarterHour(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const rounded = Math.round(minutes / 15) * 15;
  if (rounded === 60) {
    snapped.setHours(snapped.getHours() + 1, 0, 0, 0);
  } else {
    snapped.setMinutes(rounded, 0, 0);
  }
  return snapped;
}

function toDatetimeLocalValue(date: Date): string {
  const snapped = snapMinuteToQuarterHour(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${snapped.getFullYear()}-${pad(snapped.getMonth() + 1)}-${pad(
    snapped.getDate(),
  )}T${pad(snapped.getHours())}:${pad(snapped.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): Date {
  return snapMinuteToQuarterHour(new Date(value));
}

function fromAllDayStartLocalValue(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function fromAllDayEndLocalValue(value: string): Date {
  return new Date(`${value.slice(0, 10)}T23:59:59`);
}

function snapDatetimeLocalValue(value: string): string {
  if (!value.includes('T')) return value;
  return toDatetimeLocalValue(new Date(value));
}

type ScheduledItemFormField =
  | 'title'
  | 'endsAt'
  | 'reminderMinutesBefore'
  | '_form';

type ScheduledItemFieldErrors = Partial<
  Record<ScheduledItemFormField, string>
>;

function ScheduledItemFieldError({
  message,
  dataFormError,
}: {
  message?: string;
  dataFormError?: boolean;
}) {
  if (!message) return null;
  return (
    <p
      className="text-sm font-medium text-destructive"
      role="alert"
      {...(dataFormError ? { 'data-form-error': 'true' } : {})}
    >
      {message}
    </p>
  );
}

function scrollToFirstFieldError(
  formEl: HTMLFormElement | null,
  fieldErrors: ScheduledItemFieldErrors,
) {
  if (!formEl) return;

  const fieldOrder: ScheduledItemFormField[] = [
    'title',
    'endsAt',
    'reminderMinutesBefore',
    '_form',
  ];

  for (const name of fieldOrder) {
    if (!fieldErrors[name]) continue;

    if (name === '_form') {
      const formError = formEl.querySelector<HTMLElement>(
        '[data-form-error="true"]',
      );
      if (formError) {
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      continue;
    }

    const fieldEl = formEl.querySelector<HTMLElement>(
      `[name="${CSS.escape(name)}"]`,
    );
    if (fieldEl) {
      fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldEl.focus({ preventScroll: true });
      return;
    }
  }
}

function toAllDayEndLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T23:59`;
}

function resolveDurationMs(
  start: Date,
  end: Date,
  allDay: boolean,
): number {
  const delta = end.getTime() - start.getTime();
  const minimum = allDay ? 0 : MIN_TIMED_DURATION_MS;
  if (delta >= minimum) return delta;
  return allDay ? 0 : DEFAULT_TIMED_DURATION_MS;
}

function computeEndFromStart(
  start: Date,
  durationMs: number,
  allDay: boolean,
): Date {
  const end = new Date(start.getTime() + durationMs);
  if (allDay) {
    return fromAllDayEndLocalValue(toAllDayEndLocalValue(end));
  }
  return snapMinuteToQuarterHour(end);
}

function readLocalRange(
  startsAtLocal: string,
  endsAtLocal: string,
  allDay: boolean,
): { start: Date; end: Date } | null {
  if (!startsAtLocal) return null;
  const start = allDay
    ? fromAllDayStartLocalValue(startsAtLocal)
    : fromDatetimeLocalValue(startsAtLocal);
  const endSource = endsAtLocal || startsAtLocal;
  const end = allDay
    ? fromAllDayEndLocalValue(endSource)
    : fromDatetimeLocalValue(endSource);
  return { start, end };
}

function normalizeLocalRange(
  startsAtLocal: string,
  endsAtLocal: string,
  allDay: boolean,
): { startsAtLocal: string; endsAtLocal: string; durationMs: number } {
  const range = readLocalRange(startsAtLocal, endsAtLocal, allDay);
  if (!range) {
    return {
      startsAtLocal,
      endsAtLocal,
      durationMs: allDay ? 0 : DEFAULT_TIMED_DURATION_MS,
    };
  }

  const durationMs = resolveDurationMs(range.start, range.end, allDay);
  const normalizedEnd = computeEndFromStart(range.start, durationMs, allDay);
  return {
    startsAtLocal: allDay
      ? `${startsAtLocal.slice(0, 10)}T00:00`
      : toDatetimeLocalValue(range.start),
    endsAtLocal: allDay
      ? toAllDayEndLocalValue(normalizedEnd)
      : toDatetimeLocalValue(normalizedEnd),
    durationMs,
  };
}

const TYPE_EMOJI: Record<ScheduledItemType, string> = {
  call: '📞',
  event: '📅',
  meeting: '👥',
  deadline: '⏰',
  reminder: '🔔',
  booking: '📋',
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
  const [fieldErrors, setFieldErrors] =
    React.useState<ScheduledItemFieldErrors>({});
  const formRef = React.useRef<HTMLFormElement>(null);
  const durationMsRef = React.useRef(DEFAULT_TIMED_DURATION_MS);

  const clearFieldError = React.useCallback((field: ScheduledItemFormField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

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
      const normalized = normalizeLocalRange(
        toDatetimeLocalValue(initialItem.startsAt),
        toDatetimeLocalValue(initialItem.endsAt),
        initialItem.allDay,
      );
      setStartsAtLocal(normalized.startsAtLocal);
      setEndsAtLocal(normalized.endsAtLocal);
      durationMsRef.current = normalized.durationMs;
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
      const normalized = normalizeLocalRange(
        toDatetimeLocalValue(draftRange.startsAt),
        toDatetimeLocalValue(draftRange.endsAt),
        draftRange.allDay,
      );
      setStartsAtLocal(normalized.startsAtLocal);
      setEndsAtLocal(normalized.endsAtLocal);
      durationMsRef.current = normalized.durationMs;
      setAllDay(draftRange.allDay);
      setLocation('');
      setMeetingUrl('');
      resetExtendedFields();
    }
    setFieldErrors({});
  }, [open, mode, initialItem, draftRange, resetExtendedFields]);

  React.useEffect(() => {
    if ((type === 'call' || type === 'meeting') && mode === 'create' && open) {
      setMatrixAutoLink(true);
    }
  }, [type, mode, open]);

  const handleStartsAtChange = (value: string) => {
    const nextStartsAtLocal = allDay
      ? `${value}T00:00`
      : snapDatetimeLocalValue(value);
    const start = allDay
      ? fromAllDayStartLocalValue(nextStartsAtLocal)
      : fromDatetimeLocalValue(nextStartsAtLocal);
    const end = computeEndFromStart(
      start,
      durationMsRef.current,
      allDay,
    );
    const nextEndsAtLocal = allDay
      ? toAllDayEndLocalValue(end)
      : toDatetimeLocalValue(end);

    setStartsAtLocal(nextStartsAtLocal);
    setEndsAtLocal(nextEndsAtLocal);
  };

  const handleEndsAtChange = (value: string) => {
    const nextEndsAtLocal = allDay
      ? `${value}T23:59`
      : snapDatetimeLocalValue(value);
    const range = readLocalRange(startsAtLocal, nextEndsAtLocal, allDay);
    if (!range) {
      setEndsAtLocal(nextEndsAtLocal);
      return;
    }

    if (range.end.getTime() < range.start.getTime()) {
      const clampedEnd = computeEndFromStart(
        range.start,
        allDay ? 0 : MIN_TIMED_DURATION_MS,
        allDay,
      );
      const clampedEndsAtLocal = allDay
        ? toAllDayEndLocalValue(clampedEnd)
        : toDatetimeLocalValue(clampedEnd);
      durationMsRef.current = allDay ? 0 : MIN_TIMED_DURATION_MS;
      setEndsAtLocal(clampedEndsAtLocal);
      return;
    }

    durationMsRef.current = resolveDurationMs(
      range.start,
      range.end,
      allDay,
    );
    setEndsAtLocal(nextEndsAtLocal);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    const trimmedTitle = title.trim();
    const nextErrors: ScheduledItemFieldErrors = {};

    if (!trimmedTitle) {
      nextErrors.title = t('validationTitleRequired');
    }

    const startsAt = allDay
      ? fromAllDayStartLocalValue(startsAtLocal)
      : fromDatetimeLocalValue(startsAtLocal);
    const endsAt = allDay
      ? fromAllDayEndLocalValue(endsAtLocal)
      : fromDatetimeLocalValue(endsAtLocal);
    if (endsAt.getTime() < startsAt.getTime()) {
      nextErrors.endsAt = t('validationEndAfterStart');
    }

    if ((remindEmail || remindPush) && reminderMinutesBefore == null) {
      nextErrors.reminderMinutesBefore = t('validationReminderRequired');
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      requestAnimationFrame(() => {
        scrollToFirstFieldError(formRef.current, nextErrors);
      });
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
      const saveError = { _form: t('saveFailed') };
      setFieldErrors(saveError);
      requestAnimationFrame(() => {
        scrollToFirstFieldError(formRef.current, saveError);
      });
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

        <form
          ref={formRef}
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled-item-title">{t('fieldTitle')}</Label>
            <Input
              id="scheduled-item-title"
              name="title"
              value={title}
              onChange={(e) => {
                clearFieldError('title');
                setTitle(e.target.value);
              }}
              placeholder={t('fieldTitlePlaceholder')}
              maxLength={200}
              autoFocus
              aria-invalid={fieldErrors.title ? true : undefined}
            />
            <ScheduledItemFieldError message={fieldErrors.title} />
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
                const range = readLocalRange(startsAtLocal, endsAtLocal, allDay);
                setAllDay(checked);
                if (!range) return;

                if (checked) {
                  const nextStartsAtLocal = `${startsAtLocal.slice(0, 10)}T00:00`;
                  const end = computeEndFromStart(
                    fromAllDayStartLocalValue(nextStartsAtLocal),
                    durationMsRef.current,
                    true,
                  );
                  const nextEndsAtLocal = toAllDayEndLocalValue(end);
                  setStartsAtLocal(nextStartsAtLocal);
                  setEndsAtLocal(nextEndsAtLocal);
                  durationMsRef.current = resolveDurationMs(
                    fromAllDayStartLocalValue(nextStartsAtLocal),
                    fromAllDayEndLocalValue(nextEndsAtLocal),
                    true,
                  );
                  return;
                }

                const nextStartsAtLocal = toDatetimeLocalValue(range.start);
                const end = computeEndFromStart(
                  fromDatetimeLocalValue(nextStartsAtLocal),
                  durationMsRef.current,
                  false,
                );
                const nextEndsAtLocal = toDatetimeLocalValue(end);
                setStartsAtLocal(nextStartsAtLocal);
                setEndsAtLocal(nextEndsAtLocal);
                durationMsRef.current = resolveDurationMs(
                  fromDatetimeLocalValue(nextStartsAtLocal),
                  fromDatetimeLocalValue(nextEndsAtLocal),
                  false,
                );
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled-item-starts">{t('fieldStarts')}</Label>
              <Input
                id="scheduled-item-starts"
                type={allDay ? 'date' : 'datetime-local'}
                step={allDay ? undefined : DATETIME_LOCAL_STEP_SECONDS}
                value={
                  allDay && startsAtLocal
                    ? startsAtLocal.slice(0, 10)
                    : startsAtLocal
                }
                onChange={(e) => handleStartsAtChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled-item-ends">{t('fieldEnds')}</Label>
              <Input
                id="scheduled-item-ends"
                name="endsAt"
                type={allDay ? 'date' : 'datetime-local'}
                step={allDay ? undefined : DATETIME_LOCAL_STEP_SECONDS}
                value={
                  allDay && endsAtLocal ? endsAtLocal.slice(0, 10) : endsAtLocal
                }
                onChange={(e) => {
                  clearFieldError('endsAt');
                  handleEndsAtChange(e.target.value);
                }}
                aria-invalid={fieldErrors.endsAt ? true : undefined}
              />
              <ScheduledItemFieldError message={fieldErrors.endsAt} />
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
                    onValueChange={(value) => {
                      clearFieldError('reminderMinutesBefore');
                      setReminderMinutesBefore(Number.parseInt(value, 10));
                    }}
                  >
                    <SelectTrigger
                      name="reminderMinutesBefore"
                      aria-invalid={
                        fieldErrors.reminderMinutesBefore ? true : undefined
                      }
                    >
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
                  <ScheduledItemFieldError
                    message={fieldErrors.reminderMinutesBefore}
                  />
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

          {fieldErrors._form ? (
            <ScheduledItemFieldError
              message={fieldErrors._form}
              dataFormError
            />
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
