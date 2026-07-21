'use client';

import React from 'react';
import {
  COUNTRY_GROUPS,
  currencyForCountry,
  DEAL_PRIORITIES,
  isGrantOrTenderSwimlane,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  resolveRegionForSpace,
  useDealMutations,
  usePipelineConfig,
  usePipelineSettings,
  type DealPriority,
  type PipelineStatus,
  type PipelineSwimlane,
  type Region,
} from '@hypha-platform/core/client';
import {
  Button,
  Combobox,
  COMBOBOX_TITLE,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type NewDealDialogProps = {
  spaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (dealId: number) => void;
  defaultSwimlane?: PipelineSwimlane;
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-1 text-neutral-11">
      <span>
        {label}
        {required ? <span className="text-red-11"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function NewDealDialog({
  spaceSlug,
  open,
  onOpenChange,
  onCreated,
  defaultSwimlane = 'Sales',
}: NewDealDialogProps) {
  const t = useTranslations('Pipeline');
  const { createDeal, isCreating } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { regions, defaultRegion } = usePipelineConfig(spaceSlug);

  const [title, setTitle] = React.useState('');
  const [swimlane, setSwimlane] = React.useState<PipelineSwimlane | ''>(
    defaultSwimlane,
  );
  const [status, setStatus] = React.useState<PipelineStatus>('Identified');
  const [region, setRegion] = React.useState<Region>(defaultRegion);
  const [country, setCountry] = React.useState('');
  const [value, setValue] = React.useState('');
  const [priority, setPriority] = React.useState<DealPriority>('medium');
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setTitle('');
    setSwimlane(defaultSwimlane);
    setStatus('Identified');
    setRegion(defaultRegion);
    setCountry('');
    setValue('');
    setPriority('medium');
    setError(null);
  }, [defaultRegion, defaultSwimlane]);

  React.useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const countryOptions = React.useMemo(() => {
    const allow = new Set(
      (countryFocus ?? []).map((c) => c.toUpperCase()).filter(Boolean),
    );
    const options: Array<{
      value: string;
      label: string;
      searchText?: string;
    }> = [];

    for (const [group, codes] of Object.entries(COUNTRY_GROUPS)) {
      const filtered = allow.size
        ? codes.filter((code) => allow.has(code))
        : codes;
      if (!filtered.length) continue;
      options.push({ value: COMBOBOX_TITLE, label: group });
      for (const code of filtered) {
        options.push({
          value: code,
          label: code,
          searchText: `${group} ${code}`,
        });
      }
    }
    return options;
  }, [countryFocus]);

  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(swimlane) &&
    Boolean(region) &&
    Boolean(status);

  const submit = async () => {
    if (!title.trim() || !swimlane || !region || !status) {
      setError(t('newDeal.validationRequired'));
      return;
    }

    const countryCode = country.trim().toUpperCase() || null;
    const today = new Date();
    const nextActionDate = toDateOnly(today);
    const deadlineDate = new Date(today);
    deadlineDate.setMonth(deadlineDate.getMonth() + 1);

    try {
      const deal = await createDeal({
        title: title.trim(),
        pipelineSwimlane: swimlane,
        pipelineStatus: status,
        region,
        country: countryCode,
        value: value ? Number(value) : 0,
        currency: currencyForCountry(countryCode),
        priority,
        status: 'active',
        nextActionDate,
        submissionDeadline: isGrantOrTenderSwimlane(swimlane)
          ? toDateOnly(deadlineDate)
          : null,
      });
      resetForm();
      onOpenChange(false);
      onCreated(deal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('newDeal.createFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newDeal.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t('newDeal.titleLabel')} required>
            <Input
              placeholder={t('newDeal.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label={t('newDeal.swimlaneLabel')} required>
            <Select
              value={swimlane || undefined}
              onValueChange={(v) => {
                setSwimlane(v as PipelineSwimlane);
                setStatus('Identified');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('newDeal.swimlanePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_SWIMLANES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('newDeal.countryLabel')}>
            <Combobox
              options={countryOptions}
              initialValue={country}
              placeholder={t('newDeal.countryPlaceholder')}
              searchPlaceholder={t('newDeal.countrySearch')}
              allowEmptyChoice
              popoverModal={false}
              onChange={(code) => {
                const next = code?.toUpperCase() ?? '';
                setCountry(next);
                if (next) {
                  setRegion(
                    resolveRegionForSpace(next, regions, defaultRegion),
                  );
                }
              }}
            />
          </Field>

          <Field label={t('newDeal.regionLabel')} required>
            <Select
              value={region}
              onValueChange={(v) => setRegion(v as Region)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('newDeal.executionStatusLabel')} required>
            <Select
              value={status}
              disabled={!swimlane}
              onValueChange={(v) => setStatus(v as PipelineStatus)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('newDeal.executionStatusPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('newDeal.valueLabel')}>
              <Input
                type="number"
                min={0}
                placeholder={t('newDeal.valuePlaceholder')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Field label={t('newDeal.priorityLabel')}>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as DealPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {error ? (
            <p className="text-1 text-red-11" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit || isCreating}
              onClick={submit}
            >
              {t('newDeal.create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
