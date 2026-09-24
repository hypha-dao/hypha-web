'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@hypha-platform/ui';
import {
  getAgentAvatarInitials,
  tagGroupAccentClass,
  useMobilizedAiAgents,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

const AVATAR_SIZE_PX = 32;
const AVATAR_OVERLAP_PX = 8;
const OVERFLOW_BADGE_RESERVE_PX = 40;
const MAX_VISIBLE_PREVIEW_COUNT = 8;

type MembershipPreview = {
  id: string;
  label: string;
  imageUrl?: string | null;
  initials?: string;
  accentClassName?: string;
};

type EcosystemMembershipModulesProps = {
  spaceSlug: string;
  /** Visit / add (and similar) controls — sits on the same header row. */
  trailing?: ReactNode;
};

function fitVisibleAvatarCount(containerWidth: number, total: number): number {
  if (total <= 0 || containerWidth <= 0) return 0;

  for (
    let count = Math.min(total, MAX_VISIBLE_PREVIEW_COUNT);
    count >= 1;
    count -= 1
  ) {
    const stackWidth =
      AVATAR_SIZE_PX + (count - 1) * (AVATAR_SIZE_PX - AVATAR_OVERLAP_PX);
    const badgeWidth = count < total ? OVERFLOW_BADGE_RESERVE_PX : 0;
    if (stackWidth + badgeWidth <= containerWidth) {
      return count;
    }
  }

  return 1;
}

function MembershipStack({
  members,
  emptyLabel,
}: {
  members: MembershipPreview[];
  emptyLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(members.length, MAX_VISIBLE_PREVIEW_COUNT),
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setVisibleCount(fitVisibleAvatarCount(el.clientWidth, members.length));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [members.length]);

  if (members.length === 0) {
    return <p className="craft-meta truncate">{emptyLabel}</p>;
  }

  const visible = members.slice(0, visibleCount);
  const overflow = members.length - visible.length;

  return (
    <div
      ref={containerRef}
      className="flex w-full min-h-8 min-w-0 items-center overflow-hidden"
    >
      <div className="flex min-w-0 shrink -space-x-2">
        {visible.map((member) =>
          member.accentClassName ? (
            <div
              key={member.id}
              title={member.label}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${member.accentClassName}`}
              aria-label={member.label}
            >
              {member.initials ?? member.label.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <Avatar
              key={member.id}
              className="h-8 w-8 shrink-0 rounded-full border border-border/70"
              title={member.label}
            >
              <AvatarImage
                alt={member.label}
                className="rounded-full object-cover"
                src={member.imageUrl || undefined}
              />
              <AvatarFallback aria-hidden className="rounded-full text-[10px]">
                {(member.initials ?? member.label.slice(0, 2)).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
        )}
      </div>
      {overflow > 0 ? (
        <span className="ms-2 shrink-0 text-1 font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function MembershipModuleCard({
  label,
  members,
  emptyLabel,
}: {
  label: string;
  members: MembershipPreview[];
  emptyLabel: string;
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col justify-center overflow-hidden py-1 sm:px-4 sm:first:pl-0 sm:last:pr-0">
      <p className="mb-1.5 text-1 font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0 flex-1">
        <MembershipStack members={members} emptyLabel={emptyLabel} />
      </div>
    </div>
  );
}

/** One horizontal row: Individuals · Member spaces · AI agents (+ optional trailing). */
const MEMBERSHIP_ROW_CLASS =
  'flex min-w-0 flex-1 flex-row items-stretch divide-x divide-border/50';

export function EcosystemMembershipModules({
  spaceSlug,
  trailing,
}: EcosystemMembershipModulesProps) {
  const t = useTranslations('SelectNavigationAction');
  const tCoherence = useTranslations('CoherenceTab');
  const mobilizedAgents = useMobilizedAiAgents(spaceSlug);
  const { persons, spaces, isLoading } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const individuals = useMemo<MembershipPreview[]>(
    () =>
      (persons.data ?? []).map((person) => {
        const label =
          [person.name, person.surname].filter(Boolean).join(' ') ||
          person.nickname ||
          person.slug ||
          t('navigation.unnamedMember');
        return {
          id: `person-${person.id}`,
          label,
          imageUrl: person.avatarUrl,
          initials: label.slice(0, 2),
        };
      }),
    [persons.data, t],
  );

  const memberSpaces = useMemo<MembershipPreview[]>(
    () =>
      (spaces.data ?? []).map((space) => ({
        id: `space-${space.id}`,
        label: space.title,
        imageUrl: space.logoUrl,
        initials: space.title.slice(0, 2),
      })),
    [spaces.data],
  );

  const agents = useMemo<MembershipPreview[]>(
    () =>
      mobilizedAgents.map((agent) => {
        const label = tCoherence(agent.role);
        return {
          id: `agent-${agent.id}`,
          label,
          initials: getAgentAvatarInitials(label),
          accentClassName: tagGroupAccentClass(agent.tagGroup),
        };
      }),
    [mobilizedAgents, tCoherence],
  );

  // Always render all three modules — including empty Agents — so the control
  // stays visible on the header row (hiding was causing AI agent to vanish).
  const modules = useMemo(
    () => [
      {
        key: 'individuals' as const,
        label: t('navigation.individuals'),
        members: individuals,
        emptyLabel: t('navigation.noIndividuals'),
      },
      {
        key: 'memberSpaces' as const,
        label: t('navigation.memberSpaces'),
        members: memberSpaces,
        emptyLabel: t('navigation.noMemberSpaces'),
      },
      {
        key: 'agents' as const,
        label: t('navigation.agents'),
        members: agents,
        emptyLabel: t('navigation.noAgents'),
      },
    ],
    [agents, individuals, memberSpaces, t],
  );

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-border/50 py-2.5">
      <div
        className={MEMBERSHIP_ROW_CLASS}
        role={isLoading ? 'status' : undefined}
        aria-live={isLoading ? 'polite' : undefined}
      >
        {modules.map((module) =>
          isLoading &&
          module.key !== 'agents' &&
          module.members.length === 0 ? (
            <div
              key={module.key}
              className="flex h-full min-w-0 flex-1 flex-col justify-center overflow-hidden py-1 sm:px-4 sm:first:pl-0 sm:last:pr-0"
            >
              <p className="mb-1.5 text-1 font-medium uppercase tracking-wide text-muted-foreground">
                {module.label}
              </p>
              <p className="craft-meta">{t('navigation.loading')}</p>
            </div>
          ) : (
            <MembershipModuleCard
              key={module.key}
              label={module.label}
              members={module.members}
              emptyLabel={module.emptyLabel}
            />
          ),
        )}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1">{trailing}</div>
      ) : null}
    </div>
  );
}
