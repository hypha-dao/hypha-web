'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UtilityPoleIcon } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../../../people/components/person-avatar';
import type { EnergyPerson } from './use-energy-people';
import { personDisplayName, shortAddr } from './format';
import { ENERGY_PALETTE } from './charts';
import { AnimatedSourceIcon } from './animated-source-icons';

/** Placeholder until grid-operator profiles are wired to on-chain roles. */
export const GridOperatorCard = ({ right }: { right?: React.ReactNode }) => {
  const t = useTranslations('Energy.shared');
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background-2 p-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: `${ENERGY_PALETTE[2]}22`,
          color: ENERGY_PALETTE[2],
        }}
      >
        <UtilityPoleIcon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {t('gridOperatorName')}
        </p>
        <p className="truncate text-1 text-neutral-11">
          {t('gridOperatorSubtitle')}
        </p>
      </div>
      {right ? <div className="shrink-0 text-right">{right}</div> : null}
    </div>
  );
};

export const StatCard = ({
  label,
  value,
  hint,
  accent = '#5b9dff',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
  icon?: React.ReactNode;
}) => (
  <div className="relative overflow-hidden rounded-xl border border-border bg-background-2 p-4">
    <span
      className="absolute inset-x-0 top-0 h-0.5"
      style={{ backgroundColor: accent }}
    />
    <div className="flex items-start justify-between gap-2">
      <p className="text-1 text-neutral-11">{label}</p>
      {icon ? (
        <span style={{ color: accent }} className="opacity-80">
          {icon}
        </span>
      ) : null}
    </div>
    <p className="mt-1 text-5 font-semibold text-foreground">{value}</p>
    {hint ? <p className="mt-0.5 text-1 text-neutral-11">{hint}</p> : null}
  </div>
);

export const EnergyPersonCard = ({
  address,
  person,
  isLoading,
  right,
  subtitle,
}: {
  address: string;
  person?: EnergyPerson | null;
  isLoading?: boolean;
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
}) => {
  const name = personDisplayName(person) ?? shortAddr(address);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background-2 p-3">
      <PersonAvatar
        avatarSrc={person?.avatarUrl ?? undefined}
        userName={personDisplayName(person) ?? undefined}
        size="md"
        shape="circle"
        isLoading={isLoading}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{name}</p>
        {subtitle ?? (
          <p className="truncate text-1 text-neutral-11">
            {person?.nickname ? `@${person.nickname}` : shortAddr(address)}
          </p>
        )}
      </div>
      {right ? <div className="shrink-0 text-right">{right}</div> : null}
    </div>
  );
};

export const SourceCard = ({
  label,
  type,
  basePrice,
  active,
  accent,
}: {
  label: string;
  type: string;
  basePrice: string;
  active: boolean;
  accent: string;
}) => {
  const t = useTranslations('Energy.shared');
  const typeLabel =
    type === 'SOLAR'
      ? t('sourceTypeSolar')
      : type === 'BATTERY'
      ? t('sourceTypeBattery')
      : type;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background-2 p-3">
      <AnimatedSourceIcon type={type} accent={accent} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{label}</p>
        <p className="text-1 text-neutral-11">{typeLabel}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-1 text-neutral-11">{t('currentPerKwh')}</p>
        <p className="font-medium text-foreground">{basePrice}</p>
        <span
          className={cn(
            'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
            active
              ? 'bg-success-3 text-success-11'
              : 'bg-neutral-3 text-neutral-11',
          )}
        >
          {active ? t('active') : t('inactive')}
        </span>
      </div>
    </div>
  );
};

export const SectionTitle = ({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h3 className="text-3 font-medium text-foreground">{title}</h3>
      {description ? (
        <p className="text-1 text-neutral-11">{description}</p>
      ) : null}
    </div>
    {right ? <div className="shrink-0">{right}</div> : null}
  </div>
);
