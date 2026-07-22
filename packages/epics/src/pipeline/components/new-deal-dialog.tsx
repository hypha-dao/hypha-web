'use client';

import React from 'react';
import {
  currencyForCountry,
  DEAL_CONTACT_TYPES,
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
import type { UseMembers } from '../../spaces';
import { CountrySelect } from './country-select';
import { SpaceMemberSelect } from './space-member-select';

type NewDealDialogProps = {
  spaceSlug: string;
  useMembers: UseMembers;
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
    <div className="flex flex-col gap-1 text-1 text-neutral-11">
      <span>
        {label}
        {required ? <span className="text-red-11"> *</span> : null}
      </span>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-1 text-1 font-medium uppercase tracking-wide text-neutral-11">
      {children}
    </div>
  );
}

export function NewDealDialog({
  spaceSlug,
  useMembers,
  open,
  onOpenChange,
  onCreated,
  defaultSwimlane = 'Sales',
}: NewDealDialogProps) {
  const t = useTranslations('Pipeline');
  const { createDeal, isCreating } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { regions, defaultRegion } = usePipelineConfig(spaceSlug);
  const { persons, isLoading: isLoadingMembers } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const [title, setTitle] = React.useState('');
  const [accountManagerId, setAccountManagerId] = React.useState<string | null>(
    null,
  );
  const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([]);
  const [swimlane, setSwimlane] = React.useState<PipelineSwimlane | ''>(
    defaultSwimlane,
  );
  const [status, setStatus] = React.useState<PipelineStatus>('Identified');
  const [region, setRegion] = React.useState<Region>(defaultRegion);
  const [country, setCountry] = React.useState<string | null>(null);
  const [value, setValue] = React.useState('');
  const [priority, setPriority] = React.useState<DealPriority>('medium');
  const [contactUrl, setContactUrl] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [contactType, setContactType] = React.useState<string>(
    DEAL_CONTACT_TYPES[0],
  );
  const [dept, setDept] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [linkedin, setLinkedin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const members = persons?.data ?? [];

  const resetForm = React.useCallback(() => {
    setTitle('');
    setAccountManagerId(null);
    setTeamMemberIds([]);
    setSwimlane(defaultSwimlane);
    setStatus('Identified');
    setRegion(defaultRegion);
    setCountry(null);
    setValue('');
    setPriority('medium');
    setContactUrl('');
    setFirstName('');
    setLastName('');
    setRole('');
    setContactType(DEAL_CONTACT_TYPES[0]);
    setDept('');
    setEmail('');
    setMobile('');
    setLinkedin('');
    setError(null);
  }, [defaultRegion, defaultSwimlane]);

  React.useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(swimlane) &&
    Boolean(region) &&
    Boolean(status) &&
    Boolean(firstName.trim());

  const submit = async () => {
    if (!title.trim() || !swimlane || !region || !status || !firstName.trim()) {
      setError(t('newDeal.validationRequired'));
      return;
    }

    const countryCode = country?.trim().toUpperCase() || null;
    const today = new Date();
    const nextActionDate = toDateOnly(today);
    const deadlineDate = new Date(today);
    deadlineDate.setMonth(deadlineDate.getMonth() + 1);

    const parsedAccountManagerId = accountManagerId
      ? Number(accountManagerId)
      : null;
    const parsedTeamMemberIds = teamMemberIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const contactPerson = [firstName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(' ');

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
        accountManagerId: parsedAccountManagerId,
        teamMemberIds: parsedTeamMemberIds,
        contactUrl: contactUrl.trim() || null,
        contactPerson: contactPerson || null,
        contactEmail: email.trim() || null,
        linkedinUrl: linkedin.trim() || null,
        contacts: [
          {
            firstName: firstName.trim(),
            lastName: lastName.trim() || undefined,
            role: role.trim() || undefined,
            contactType: contactType || undefined,
            dept: dept.trim() || undefined,
            email: email.trim() || undefined,
            mobile: mobile.trim() || undefined,
            linkedin: linkedin.trim() || undefined,
            isPrimary: true,
          },
        ],
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
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-pipeline-select-content="true"]')) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-pipeline-select-content="true"]')) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-pipeline-select-content="true"]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('newDeal.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <SectionTitle>{t('newDeal.overviewSection')}</SectionTitle>

          <Field label={t('newDeal.titleLabel')} required>
            <Input
              placeholder={t('newDeal.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label={t('newDeal.accountManagerLabel')}>
            <SpaceMemberSelect
              members={members}
              value={accountManagerId}
              onChange={setAccountManagerId}
              allowUnassigned
              popoverModal={false}
              unassignedLabel={t('newDeal.accountManagerUnassigned')}
              placeholder={
                isLoadingMembers
                  ? t('newDeal.loadingMembers')
                  : t('newDeal.accountManagerUnassigned')
              }
              searchPlaceholder={t('newDeal.memberSearch')}
              emptyListMessage={t('newDeal.noMembers')}
              unknownLabel={t('newDeal.unknownMember')}
              disabled={isLoadingMembers}
            />
          </Field>

          <Field label={t('newDeal.teammatesLabel')}>
            <SpaceMemberSelect
              mode="multi"
              members={members}
              value={teamMemberIds}
              onChange={setTeamMemberIds}
              popoverModal={false}
              placeholder={
                isLoadingMembers
                  ? t('newDeal.loadingMembers')
                  : t('newDeal.teammatesPlaceholder')
              }
              searchPlaceholder={t('newDeal.memberSearch')}
              emptyListMessage={t('newDeal.noMembers')}
              unknownLabel={t('newDeal.unknownMember')}
              disabled={isLoadingMembers}
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
            <CountrySelect
              value={country}
              countryFocus={countryFocus}
              popoverModal={false}
              placeholder={t('newDeal.countryPlaceholder')}
              searchPlaceholder={t('newDeal.countrySearch')}
              noneLabel={t('fields.noCountry')}
              emptyListMessage={t('newDeal.noCountries')}
              onChange={(code) => {
                setCountry(code);
                if (code) {
                  setRegion(
                    resolveRegionForSpace(code, regions, defaultRegion),
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

          <SectionTitle>{t('newDeal.contactSection')}</SectionTitle>

          <Field label={t('newDeal.companyUrlLabel')}>
            <Input
              placeholder={t('newDeal.companyUrlPlaceholder')}
              value={contactUrl}
              onChange={(e) => setContactUrl(e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-3 rounded-lg border border-neutral-5 bg-neutral-2 p-3">
            <div className="flex items-center gap-2">
              <span className="text-2 font-medium text-neutral-12">
                {t('newDeal.contact1')}
              </span>
              <span className="rounded bg-accent-4 px-1.5 py-0.5 text-1 text-accent-11">
                {t('contacts.primary')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('contacts.firstName')} required>
                <Input
                  placeholder={t('newDeal.firstNamePlaceholder')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field label={t('contacts.lastName')}>
                <Input
                  placeholder={t('newDeal.lastNamePlaceholder')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </div>

            <Field label={t('contacts.role')}>
              <Input
                placeholder={t('newDeal.rolePlaceholder')}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </Field>

            <Field label={t('newDeal.contactTypeLabel')}>
              <Select value={contactType} onValueChange={setContactType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_CONTACT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('newDeal.departmentLabel')}>
              <Input
                placeholder={t('newDeal.departmentPlaceholder')}
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('contacts.email')}>
                <Input
                  type="email"
                  placeholder={t('newDeal.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t('newDeal.mobileLabel')}>
                <Input
                  placeholder={t('newDeal.mobilePlaceholder')}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </Field>
            </div>

            <Field label={t('newDeal.linkedinLabel')}>
              <Input
                placeholder={t('newDeal.linkedinPlaceholder')}
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
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
