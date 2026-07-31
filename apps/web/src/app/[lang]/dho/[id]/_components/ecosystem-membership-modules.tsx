'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@hypha-platform/ui';
import {
  getAgentAvatarInitials,
  readMobilizedAiAgents,
  subscribeMobilizedAiAgents,
  tagGroupAccentClass,
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

function MembershipStack({ members }: { members: MembershipPreview[] }) {
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

  const visible = members.slice(0, visibleCount);
  const overflow = members.length - visible.length;

  return (
    <div
      ref={containerRef}
      className="flex min-h-8 min-w-0 items-center overflow-hidden"
    >
      <div className="flex -space-x-2">
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
              className="h-8 w-8 shrink-0 rounded-full border-2 border-background-2 shadow-sm"
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
}: {
  label: string;
  members: MembershipPreview[];
}) {
  return (
    <div className="craft-card min-w-0 overflow-hidden px-3 py-2.5">
      <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <MembershipStack members={members} />
    </div>
  );
}

function membershipGridClassName(count: number): string {
  if (count <= 1) return 'grid gap-3 grid-cols-1';
  if (count === 2) return 'grid gap-3 sm:grid-cols-2';
  return 'grid gap-3 sm:grid-cols-3';
}

export function EcosystemMembershipModules({
  spaceSlug,
}: EcosystemMembershipModulesProps) {
  const t = useTranslations('SelectNavigationAction');
  const tCoherence = useTranslations('CoherenceTab');
  const [agentRefreshEpoch, setAgentRefreshEpoch] = useState(0);
  const { persons, spaces, isLoading } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  useEffect(() => {
    const unsubscribe = subscribeMobilizedAiAgents(spaceSlug, () =>
      setAgentRefreshEpoch((value) => value + 1),
    );
    return unsubscribe;
  }, [spaceSlug]);

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

  const agents = useMemo<MembershipPreview[]>(() => {
    void agentRefreshEpoch;
    return readMobilizedAiAgents(spaceSlug).map((agent) => {
      const label = tCoherence(agent.role);
      return {
        id: `agent-${agent.id}`,
        label,
        initials: getAgentAvatarInitials(label),
        accentClassName: tagGroupAccentClass(agent.tagGroup),
      };
    });
  }, [agentRefreshEpoch, spaceSlug, tCoherence]);

  const modules = useMemo(
    () =>
      [
        {
          key: 'individuals' as const,
          label: t('navigation.individuals'),
          members: individuals,
        },
        {
          key: 'memberSpaces' as const,
          label: t('navigation.memberSpaces'),
          members: memberSpaces,
        },
        {
          key: 'agents' as const,
          label: t('navigation.agents'),
          members: agents,
        },
      ].filter((module) => module.members.length > 0),
    [agents, individuals, memberSpaces, t],
  );

  if (isLoading && individuals.length === 0 && memberSpaces.length === 0) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-3"
        role="status"
        aria-live="polite"
      >
        {(['individuals', 'memberSpaces', 'agents'] as const).map((key) => (
          <div
            key={key}
            className="craft-card min-w-0 overflow-hidden px-3 py-2.5"
          >
            <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
              {t(`navigation.${key}`)}
            </p>
            <p className="craft-meta">{t('navigation.loading')}</p>
          </div>
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return null;
  }

  return (
    <div className={membershipGridClassName(modules.length)}>
      {modules.map((module) => (
        <MembershipModuleCard
          key={module.key}
          label={module.label}
          members={module.members}
        />
      ))}
    </div>
  );
}
