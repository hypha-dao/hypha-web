'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import {
  revalidateScheduledItems,
  useScheduledItemMutations,
  type RecurrencePreset,
  RECURRENCE_PRESETS,
  detectRecurrencePreset,
  SCHEDULED_ITEM_TYPES,
  COHERENCE_SIGNAL_TYPES,
  type ScheduledItem,
  type ScheduledItemType,
  useFindCoherences,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Button,
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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ButtonBack } from '../../common/button-back';
import {
  ButtonClose,
  createAsideOverlayCloseHandler,
} from '../../common/button-close';

const DATETIME_LOCAL_STEP_SECONDS = 300;
const DEFAULT_TIMED_DURATION_MS = 60 * 60 * 1000;
const MIN_TIMED_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_MEETING_REMINDER_MINUTES = 15;

function resolveReminderMinutesBefore(
  type: ScheduledItemType,
  existing: number | null | undefined,
): number | null {
  if (existing != null) return existing;
  if (type === 'meeting' || type === 'call') {
    return DEFAULT_MEETING_REMINDER_MINUTES;
  }
  return null;
}

function snapMinuteToFiveMinuteStep(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const rounded = Math.round(minutes / 5) * 5;
  if (rounded === 60) {
    snapped.setHours(snapped.getHours() + 1, 0, 0, 0);
  } else {
    snapped.setMinutes(rounded, 0, 0);
  }
  return snapped;
}

function toDatetimeLocalValue(date: Date): string {
  const snapped = snapMinuteToFiveMinuteStep(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${snapped.getFullYear()}-${pad(snapped.getMonth() + 1)}-${pad(
    snapped.getDate(),
  )}T${pad(snapped.getHours())}:${pad(snapped.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): Date {
  return snapMinuteToFiveMinuteStep(new Date(value));
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
  | 'startsAt'
  | 'endsAt'
  | 'recurrenceUntil'
  | '_form';

type ScheduledItemFieldErrors = Partial<Record<ScheduledItemFormField, string>>;

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

function scrollFieldIntoOverlayView(fieldEl: HTMLElement) {
  const panel =
    fieldEl.closest('#proposal-overlay-panel') ??
    document.getElementById('proposal-overlay-panel');
  if (!panel) {
    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const stickyHeaderOffset = 112;
  const panelRect = panel.getBoundingClientRect();
  const fieldRect = fieldEl.getBoundingClientRect();
  const targetScrollTop =
    panel.scrollTop + (fieldRect.top - panelRect.top) - stickyHeaderOffset;

  panel.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: 'smooth',
  });
}

function scrollToFirstFieldError(
  formEl: HTMLFormElement | null,
  fieldErrors: ScheduledItemFieldErrors,
) {
  if (!formEl) return;

  const fieldOrder: ScheduledItemFormField[] = [
    'title',
    'startsAt',
    'endsAt',
    'recurrenceUntil',
    '_form',
  ];

  for (const name of fieldOrder) {
    if (!fieldErrors[name]) continue;

    if (name === '_form') {
      const formError = formEl.querySelector<HTMLElement>(
        '[data-form-error="true"]',
      );
      if (formError) {
        scrollFieldIntoOverlayView(formError);
        return;
      }
      continue;
    }

    const fieldEl = formEl.querySelector<HTMLElement>(
      `[name="${CSS.escape(name)}"]`,
    );
    if (fieldEl) {
      scrollFieldIntoOverlayView(fieldEl);
      fieldEl.focus({ preventScroll: true });
      return;
    }
  }
}

function formatSaveError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;
  if (message.includes('authToken is required')) {
    return fallback;
  }
  if (message.length > 180) {
    return fallback;
  }
  return message;
}

function toAllDayEndLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T23:59`;
}

function resolveDurationMs(start: Date, end: Date, allDay: boolean): number {
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
  return snapMinuteToFiveMinuteStep(end);
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
  coherenceId?: number | null;
};

export type ScheduledItemFormProps = {
  mode: 'create' | 'edit';
  spaceId: number;
  spaceSlug: string;
  lang?: string;
  successfulUrl: string;
  closeUrl: string;
  backUrl: string;
  initialItem?: ScheduledItem | null;
  draftRange?: {
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    title?: string;
    type?: ScheduledItemType;
    coherenceId?: number | null;
  } | null;
  linkedSignal?: {
    coherenceId: number;
    title: string;
    slug?: string | null;
  } | null;
};

/** @deprecated Use {@link ScheduledItemForm} */
export type ScheduledItemFormDialogProps = ScheduledItemFormProps;

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function ScheduledItemForm({
  mode,
  spaceId,
  spaceSlug,
  lang = 'en',
  successfulUrl,
  closeUrl,
  backUrl,
  initialItem,
  draftRange,
  linkedSignal,
}: ScheduledItemFormProps) {
  const t = useTranslations('Calendar');
  const router = useRouter();
  const pathname = usePathname();
  const { getAccessToken } = useAuthentication();
  const [authToken, setAuthToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getAccessToken().then(setAuthToken);
  }, [getAccessToken]);

  const {
    createScheduledItem,
    updateScheduledItem,
    deleteScheduledItem,
    isCreating,
    isUpdating,
    isDeleting,
  } = useScheduledItemMutations(authToken, spaceSlug, lang);

  const isSubmitting = isCreating || isUpdating;

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
  const [coherenceId, setCoherenceId] = React.useState<number | null>(null);
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
  }, []);

  const lockedLinkedSignal = linkedSignal ?? null;
  const { coherences: spaceSignals } = useFindCoherences({
    spaceSlug,
    includeArchived: false,
  });
  const selectableSignals = React.useMemo(
    () =>
      (spaceSignals ?? []).filter(
        (signal) =>
          typeof signal.id === 'number' &&
          signal.id > 0 &&
          (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(signal.type),
      ),
    [spaceSignals],
  );

  React.useEffect(() => {
    if (mode === 'edit' && initialItem) {
      setTitle(initialItem.title);
      setDescription(initialItem.description ?? '');
      setType(initialItem.type);
      const normalized = normalizeLocalRange(
        toDatetimeLocalValue(asDate(initialItem.startsAt)),
        toDatetimeLocalValue(asDate(initialItem.endsAt)),
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
          ? toDatetimeLocalValue(asDate(initialItem.recurrenceUntil)).slice(
              0,
              10,
            )
          : '',
      );
      setMatrixAutoLink(initialItem.matrixAutoLink);
      setCoherenceId(initialItem.coherenceId ?? null);
    } else if (draftRange) {
      setTitle(draftRange.title?.trim() ?? '');
      setDescription('');
      setType(draftRange.type ?? 'event');
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
      setCoherenceId(
        lockedLinkedSignal?.coherenceId ?? draftRange.coherenceId ?? null,
      );
      resetExtendedFields();
    } else if (mode === 'create') {
      const now = new Date();
      const end = new Date(now.getTime() + DEFAULT_TIMED_DURATION_MS);
      const normalized = normalizeLocalRange(
        toDatetimeLocalValue(now),
        toDatetimeLocalValue(end),
        false,
      );
      setTitle('');
      setDescription('');
      setType('event');
      setStartsAtLocal(normalized.startsAtLocal);
      setEndsAtLocal(normalized.endsAtLocal);
      durationMsRef.current = normalized.durationMs;
      setAllDay(false);
      setLocation('');
      setMeetingUrl('');
      setCoherenceId(lockedLinkedSignal?.coherenceId ?? null);
      resetExtendedFields();
    }
    setFieldErrors({});
  }, [mode, initialItem, draftRange, lockedLinkedSignal, resetExtendedFields]);

  React.useEffect(() => {
    if ((type === 'call' || type === 'meeting') && mode === 'create') {
      setMatrixAutoLink(true);
    }
  }, [type, mode]);

  const handleStartsAtChange = (value: string) => {
    const nextStartsAtLocal = allDay
      ? `${value}T00:00`
      : snapDatetimeLocalValue(value);
    const start = allDay
      ? fromAllDayStartLocalValue(nextStartsAtLocal)
      : fromDatetimeLocalValue(nextStartsAtLocal);
    const end = computeEndFromStart(start, durationMsRef.current, allDay);
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

    durationMsRef.current = resolveDurationMs(range.start, range.end, allDay);
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

    if (!startsAtLocal.trim()) {
      nextErrors.startsAt = t('validationStartRequired');
    } else if (!endsAtLocal.trim()) {
      nextErrors.endsAt = t('validationEndRequired');
    }

    const startsAt = allDay
      ? fromAllDayStartLocalValue(startsAtLocal)
      : fromDatetimeLocalValue(startsAtLocal);
    const endsAt = allDay
      ? fromAllDayEndLocalValue(endsAtLocal)
      : fromDatetimeLocalValue(endsAtLocal);

    if (startsAtLocal.trim() && Number.isNaN(startsAt.getTime())) {
      nextErrors.startsAt = t('validationInvalidDates');
    } else if (endsAtLocal.trim() && Number.isNaN(endsAt.getTime())) {
      nextErrors.endsAt = t('validationInvalidDates');
    } else if (
      startsAtLocal.trim() &&
      endsAtLocal.trim() &&
      endsAt.getTime() < startsAt.getTime()
    ) {
      nextErrors.endsAt = t('validationEndAfterStart');
    }

    if (
      recurrencePreset !== 'none' &&
      recurrenceUntilLocal &&
      !Number.isNaN(startsAt.getTime())
    ) {
      const recurrenceUntil = fromDatetimeLocalValue(
        `${recurrenceUntilLocal}T23:59`,
      );
      if (recurrenceUntil.getTime() < startsAt.getTime()) {
        nextErrors.recurrenceUntil = t('validationRecurrenceUntilBeforeStart');
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      requestAnimationFrame(() => {
        scrollToFirstFieldError(formRef.current, nextErrors);
      });
      return;
    }

    try {
      const values = {
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
        remindEmail: false,
        remindPush: false,
        reminderMinutesBefore: resolveReminderMinutesBefore(
          type,
          mode === 'edit' ? initialItem?.reminderMinutesBefore : null,
        ),
        coherenceId,
      };

      if (mode === 'create') {
        await createScheduledItem({ spaceId, ...values });
      } else if (initialItem) {
        await updateScheduledItem({ id: initialItem.id, ...values });
      }

      await revalidateScheduledItems(spaceSlug);
      router.push(successfulUrl);
    } catch (error) {
      const saveError = {
        _form: formatSaveError(error, t('saveFailed')),
      };
      setFieldErrors(saveError);
      requestAnimationFrame(() => {
        scrollToFirstFieldError(formRef.current, saveError);
      });
    }
  };

  const handleDelete = async () => {
    if (!initialItem) return;
    try {
      await deleteScheduledItem({ id: initialItem.id });
      await revalidateScheduledItems(spaceSlug);
      router.push(successfulUrl);
    } catch (error) {
      const saveError = {
        _form: formatSaveError(error, t('saveFailed')),
      };
      setFieldErrors(saveError);
      requestAnimationFrame(() => {
        scrollToFirstFieldError(formRef.current, saveError);
      });
    }
  };

  const showCallFields = type === 'call' || type === 'meeting';
  const panelTitle = mode === 'create' ? t('createTitle') : t('editTitle');
  const handleOverlayClose = React.useCallback(
    createAsideOverlayCloseHandler({ closeUrl, pathname, router }),
    [closeUrl, pathname, router],
  );

  return (
    <>
      <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2/95 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7">
        <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
            {panelTitle}
          </h2>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
            <ButtonBack
              label={t('backToCalendar')}
              backUrl={backUrl}
              className="px-0 md:px-3 align-top"
            />
            <ButtonClose
              closeUrl={closeUrl}
              preferBack
              className="px-0 md:px-3 align-top"
            />
          </div>
        </div>
        <p className="px-4 pb-4 pt-3 text-sm text-muted-foreground lg:px-7">
          {mode === 'create' ? t('createDescription') : t('editDescription')}
        </p>
      </div>

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

        {lockedLinkedSignal ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('fieldLinkedSignal')}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {lockedLinkedSignal.title}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduled-item-linked-signal">
              {t('fieldLinkedSignalOptional')}
            </Label>
            <Select
              value={coherenceId != null ? String(coherenceId) : 'none'}
              onValueChange={(value) =>
                setCoherenceId(value === 'none' ? null : Number(value))
              }
            >
              <SelectTrigger id="scheduled-item-linked-signal">
                <SelectValue placeholder={t('fieldLinkedSignalPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('fieldLinkedSignalNone')}
                </SelectItem>
                {selectableSignals.map((signal) => (
                  <SelectItem key={signal.id} value={String(signal.id)}>
                    {signal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
              name="startsAt"
              type={allDay ? 'date' : 'datetime-local'}
              step={allDay ? undefined : DATETIME_LOCAL_STEP_SECONDS}
              value={
                allDay && startsAtLocal
                  ? startsAtLocal.slice(0, 10)
                  : startsAtLocal
              }
              onChange={(e) => {
                clearFieldError('startsAt');
                handleStartsAtChange(e.target.value);
              }}
              aria-invalid={fieldErrors.startsAt ? true : undefined}
            />
            <ScheduledItemFieldError message={fieldErrors.startsAt} />
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
                name="recurrenceUntil"
                type="date"
                value={recurrenceUntilLocal}
                onChange={(e) => {
                  clearFieldError('recurrenceUntil');
                  setRecurrenceUntilLocal(e.target.value);
                }}
                aria-invalid={fieldErrors.recurrenceUntil ? true : undefined}
              />
              <ScheduledItemFieldError message={fieldErrors.recurrenceUntil} />
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
          <Label htmlFor="scheduled-item-location">{t('fieldLocation')}</Label>
          <Input
            id="scheduled-item-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('fieldLocationPlaceholder')}
          />
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
              date: format(asDate(initialItem.createdAt), 'PPp'),
            })}
          </p>
        ) : null}

        {Object.keys(fieldErrors).length > 0 ? (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            data-form-error="true"
          >
            {fieldErrors._form ?? t('validationSummary')}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-[1] -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-background-2/95 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7 lg:px-7">
          {mode === 'edit' && initialItem ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="error"
              disabled={isSubmitting || isDeleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? t('deleting') : t('delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="ml-auto flex gap-2">
            <Button
              asChild
              type="button"
              variant="outline"
              colorVariant="neutral"
            >
              <Link href={closeUrl} scroll={false} onClick={handleOverlayClose}>
                {t('cancel')}
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={!authToken || isSubmitting || isDeleting}
            >
              {isSubmitting ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

/** @deprecated Use {@link ScheduledItemForm} in a {@link ProposalOverlayShell} aside route */
export const ScheduledItemFormDialog = ScheduledItemForm;
