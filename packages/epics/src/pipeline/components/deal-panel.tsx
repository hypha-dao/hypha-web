'use client';

import React from 'react';
import {
  currencyForCountry,
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  getDealProbability,
  isGrantOrTenderSwimlane,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  resolveRegionForSpace,
  useDealMutations,
  useDeals,
  usePipelineConfig,
  usePipelineSettings,
  type Deal,
  type DealContact,
  type DealPriority,
  type DealStatus,
  type PipelineStatus,
  type PipelineSwimlane,
  type Region,
  type UpdateDealInput,
} from '@hypha-platform/core/client';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Separator,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { CountrySelect } from './country-select';

type DealPanelProps = {
  spaceSlug: string;
  dealId: number;
  onDeleted?: () => void;
};

function useDebouncedSave(
  dealId: number,
  patchDeal: (id: number, patch: UpdateDealInput) => Promise<Deal>,
) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulate edits made within the debounce window so quick successive
  // field changes are merged into one patch instead of overwriting each other.
  const pendingRef = React.useRef<UpdateDealInput>({});
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const schedule = React.useCallback(
    (patch: UpdateDealInput) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const merged = pendingRef.current;
        pendingRef.current = {};
        setSaving(true);
        try {
          await patchDeal(dealId, merged);
          setSavedAt(new Date());
        } finally {
          setSaving(false);
        }
      }, 400);
    },
    [dealId, patchDeal],
  );

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Flush edits still waiting on the debounce timer so closing the panel
      // within the window does not silently drop them. No state updates here —
      // the component is unmounting.
      const pending = pendingRef.current;
      pendingRef.current = {};
      if (Object.keys(pending).length > 0) {
        void patchDeal(dealId, pending).catch(() => undefined);
      }
    },
    [dealId, patchDeal],
  );

  return { schedule, saving, savedAt };
}

export function DealPanel({ spaceSlug, dealId, onDeleted }: DealPanelProps) {
  const t = useTranslations('Pipeline');
  const { deals, isLoading } = useDeals({ spaceSlug });
  const { patchDeal, deleteDeal, isDeleting } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { regions, defaultRegion, probabilities } =
    usePipelineConfig(spaceSlug);
  const deal = deals.find((d) => d.id === dealId) ?? null;
  const { schedule, saving, savedAt } = useDebouncedSave(dealId, patchDeal);

  if (isLoading && !deal) {
    return <div className="p-4 text-2 text-neutral-11">{t('loading')}</div>;
  }
  if (!deal) {
    return <div className="p-4 text-2 text-neutral-11">{t('notFound')}</div>;
  }

  const grantTender = isGrantOrTenderSwimlane(deal.pipelineSwimlane);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <Input
          className="text-3 font-medium"
          defaultValue={deal.title}
          onBlur={(e) => {
            const title = e.target.value.trim();
            if (title && title !== deal.title) schedule({ title });
          }}
        />
        <div className="shrink-0 text-1 text-neutral-11">
          {saving ? t('saving') : savedAt ? t('saved') : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('fields.swimlane')}>
          <Select
            value={deal.pipelineSwimlane}
            onValueChange={(v) =>
              schedule({ pipelineSwimlane: v as PipelineSwimlane })
            }
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
        </Field>
        <Field label={t('fields.status')}>
          <Select
            value={deal.pipelineStatus}
            onValueChange={(v) =>
              schedule({ pipelineStatus: v as PipelineStatus })
            }
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
        </Field>
        <Field label={t('fields.country')}>
          <CountrySelect
            value={deal.country}
            countryFocus={countryFocus}
            popoverModal
            placeholder={t('fields.noCountry')}
            noneLabel={t('fields.noCountry')}
            onChange={(country) => {
              schedule({
                country,
                region: resolveRegionForSpace(country, regions, defaultRegion),
                currency: currencyForCountry(country),
              });
            }}
          />
        </Field>
        <Field label={t('fields.region')}>
          <Select
            value={
              regions.includes(deal.region) ? deal.region : regions[0] ?? ''
            }
            onValueChange={(v) => schedule({ region: v as Region })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Keep legacy region visible if it was removed from config */}
              {!regions.includes(deal.region) && deal.region ? (
                <SelectItem value={deal.region}>{deal.region}</SelectItem>
              ) : null}
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('fields.value')}>
          <Input
            type="number"
            min={0}
            defaultValue={deal.value}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value !== deal.value) {
                schedule({ value });
              }
            }}
          />
        </Field>
        <Field label={t('fields.currency')}>
          <Input
            defaultValue={deal.currency}
            onBlur={(e) => {
              const currency = e.target.value.trim();
              if (currency && currency !== deal.currency) {
                schedule({ currency });
              }
            }}
          />
        </Field>
        <Field label={t('fields.priority')}>
          <Select
            value={deal.priority}
            onValueChange={(v) => schedule({ priority: v as DealPriority })}
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
        <Field label={t('fields.dealStatus')}>
          <Select
            value={deal.status}
            onValueChange={(v) => schedule({ status: v as DealStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('fields.successRate')}>
          <Input
            key={`success-rate-${deal.pipelineSwimlane}-${
              deal.pipelineStatus
            }-${deal.successRate ?? 'default'}`}
            type="number"
            min={0}
            max={100}
            defaultValue={deal.successRate ?? ''}
            placeholder={String(
              getDealProbability(
                deal.pipelineSwimlane,
                deal.pipelineStatus,
                probabilities,
              ),
            )}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                if (deal.successRate != null) schedule({ successRate: null });
                return;
              }
              const n = Math.min(100, Math.max(0, Math.round(Number(raw))));
              if (Number.isFinite(n) && n !== deal.successRate) {
                schedule({ successRate: n });
              }
            }}
          />
          <span className="text-1 text-neutral-10">
            {deal.successRate != null
              ? t('fields.successRateOverride')
              : t('fields.successRateDefault', {
                  rate: getDealProbability(
                    deal.pipelineSwimlane,
                    deal.pipelineStatus,
                    probabilities,
                  ),
                })}
          </span>
        </Field>
      </div>

      <Separator />
      <ContactsEditor
        contacts={deal.contacts}
        onChange={(contacts) => schedule({ contacts })}
      />

      <Separator />
      <Field label={t('fields.nextAction')}>
        <Input
          defaultValue={deal.nextAction ?? ''}
          onBlur={(e) => {
            const nextAction = e.target.value.trim() || null;
            if (nextAction !== deal.nextAction) schedule({ nextAction });
          }}
        />
      </Field>
      <Field label={t('fields.nextActionDate')}>
        <Input
          type="date"
          defaultValue={deal.nextActionDate ?? ''}
          onBlur={(e) => {
            const nextActionDate = e.target.value || null;
            if (nextActionDate !== deal.nextActionDate) {
              schedule({ nextActionDate });
            }
          }}
        />
      </Field>
      <Field label={t('fields.notes')}>
        <Textarea
          defaultValue={deal.notes ?? ''}
          onBlur={(e) => {
            const notes = e.target.value.trim() || null;
            if (notes !== deal.notes) schedule({ notes });
          }}
        />
      </Field>
      <Field label={t('fields.tags')}>
        <Input
          defaultValue={deal.tags.join(', ')}
          placeholder={t('fields.tagsPlaceholder')}
          onBlur={(e) => {
            const tags = e.target.value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean);
            schedule({ tags });
          }}
        />
      </Field>

      {grantTender ? (
        <>
          <Separator />
          <div className="text-2 font-medium">{t('grantTender.title')}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('fields.submissionDeadline')}>
              <Input
                type="date"
                defaultValue={deal.submissionDeadline ?? ''}
                onBlur={(e) =>
                  schedule({ submissionDeadline: e.target.value || null })
                }
              />
            </Field>
            <Field label={t('fields.fundingRateSme')}>
              <Input
                type="number"
                defaultValue={deal.fundingRateSme ?? ''}
                onBlur={(e) => {
                  const n = e.target.value ? Number(e.target.value) : null;
                  schedule({ fundingRateSme: n });
                }}
              />
            </Field>
            <Field label={t('fields.maxProjectSize')}>
              <Input
                type="number"
                defaultValue={deal.maxProjectSize ?? ''}
                onBlur={(e) => {
                  const n = e.target.value ? Number(e.target.value) : null;
                  schedule({ maxProjectSize: n });
                }}
              />
            </Field>
            <Field label={t('fields.callReference')}>
              <Input
                defaultValue={deal.callReference ?? ''}
                onBlur={(e) =>
                  schedule({ callReference: e.target.value.trim() || null })
                }
              />
            </Field>
            <Field label={t('fields.programme')}>
              <Input
                defaultValue={deal.programme ?? ''}
                onBlur={(e) =>
                  schedule({ programme: e.target.value.trim() || null })
                }
              />
            </Field>
            <Field label={t('fields.expectedPartners')}>
              <Input
                defaultValue={deal.expectedPartners ?? ''}
                onBlur={(e) =>
                  schedule({ expectedPartners: e.target.value.trim() || null })
                }
              />
            </Field>
          </div>
          <Field label={t('fields.eligibilityNotes')}>
            <Textarea
              defaultValue={deal.eligibilityNotes ?? ''}
              onBlur={(e) =>
                schedule({ eligibilityNotes: e.target.value.trim() || null })
              }
            />
          </Field>
        </>
      ) : null}

      <Separator />
      <Button
        type="button"
        variant="outline"
        disabled={isDeleting}
        onClick={async () => {
          await deleteDeal({ id: deal.id });
          onDeleted?.();
        }}
      >
        {t('delete')}
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-1 text-neutral-11">
      <span>{label}</span>
      {children}
    </div>
  );
}

function ContactsEditor({
  contacts,
  onChange,
}: {
  contacts: DealContact[];
  onChange: (contacts: DealContact[]) => void;
}) {
  const t = useTranslations('Pipeline');
  const list = contacts.length ? contacts : [{}];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-2 font-medium">{t('contacts.title')}</div>
      {list.map((contact, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-5 p-3"
        >
          <Input
            placeholder={t('contacts.firstName')}
            defaultValue={contact.firstName ?? ''}
            onBlur={(e) => {
              const next = [...list];
              next[index] = { ...next[index], firstName: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder={t('contacts.lastName')}
            defaultValue={contact.lastName ?? ''}
            onBlur={(e) => {
              const next = [...list];
              next[index] = { ...next[index], lastName: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder={t('contacts.email')}
            defaultValue={contact.email ?? ''}
            onBlur={(e) => {
              const next = [...list];
              next[index] = { ...next[index], email: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder={t('contacts.role')}
            defaultValue={contact.role ?? ''}
            onBlur={(e) => {
              const next = [...list];
              next[index] = { ...next[index], role: e.target.value };
              onChange(next);
            }}
          />
          <label className="col-span-2 flex items-center gap-2 text-1">
            <input
              type="checkbox"
              checked={Boolean(contact.isPrimary)}
              onChange={(e) => {
                const next = list.map((c, i) => ({
                  ...c,
                  isPrimary: i === index ? e.target.checked : false,
                }));
                onChange(next);
              }}
            />
            {t('contacts.primary')}
          </label>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...list, {}])}
      >
        {t('contacts.add')}
      </Button>
    </div>
  );
}
