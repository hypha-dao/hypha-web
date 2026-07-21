'use client';

import React from 'react';
import {
  currencyForCountry,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  REGIONS,
  regionForCountry,
  useDealMutations,
  type PipelineStatus,
  type PipelineSwimlane,
  type Region,
  type DealPriority,
  DEAL_PRIORITIES,
} from '@hypha-platform/core/client';
import {
  Button,
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

export function NewDealDialog({
  spaceSlug,
  open,
  onOpenChange,
  onCreated,
  defaultSwimlane = 'Sales',
}: NewDealDialogProps) {
  const t = useTranslations('Pipeline');
  const { createDeal, isCreating } = useDealMutations(spaceSlug);
  const [title, setTitle] = React.useState('');
  const [swimlane, setSwimlane] =
    React.useState<PipelineSwimlane>(defaultSwimlane);
  const [status, setStatus] = React.useState<PipelineStatus>('Identified');
  const [region, setRegion] = React.useState<Region>('Global');
  const [country, setCountry] = React.useState('');
  const [value, setValue] = React.useState('');
  const [priority, setPriority] = React.useState<DealPriority>('medium');

  React.useEffect(() => {
    if (open) {
      setSwimlane(defaultSwimlane);
    }
  }, [defaultSwimlane, open]);

  const submit = async () => {
    if (!title.trim()) return;
    const countryCode = country.trim().toUpperCase() || null;
    const deal = await createDeal({
      title: title.trim(),
      pipelineSwimlane: swimlane,
      pipelineStatus: status,
      region: countryCode ? regionForCountry(countryCode) : region,
      country: countryCode,
      value: value ? Number(value) : 0,
      currency: currencyForCountry(countryCode),
      priority,
    });
    setTitle('');
    setValue('');
    setCountry('');
    onOpenChange(false);
    onCreated(deal.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newDeal.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder={t('newDeal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={swimlane}
              onValueChange={(v) => setSwimlane(v as PipelineSwimlane)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_SWIMLANES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PipelineStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={region}
              onValueChange={(v) => setRegion(v as Region)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('newDeal.countryPlaceholder')}
              value={country}
              maxLength={2}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setCountry(next);
                if (next.length === 2) {
                  setRegion(regionForCountry(next));
                }
              }}
            />
            <Input
              type="number"
              min={0}
              placeholder={t('newDeal.valuePlaceholder')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
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
          </div>
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
              disabled={!title.trim() || isCreating}
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
