'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@hypha-platform/ui';
import {
  getAgentAvatarInitials,
  readMobilizedAiAgents,
  subscribeMobilizedAiAgents,
  tagGroupAccentClass,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

const VISIBLE_PREVIEW_COUNT = 8;

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

function MembershipStack({
  members,
  emptyLabel,
}: {
  members: MembershipPreview[];
  emptyLabel: string;
}) {
  if (members.length === 0) {
    return <p className="craft-meta">{emptyLabel}</p>;
  }

  const visible = members.slice(0, VISIBLE_PREVIEW_COUNT);
  const overflow = members.length - visible.length;

  return (
    <div className="flex min-h-8 items-center">
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
              className="h-8 w-8 rounded-full border-2 border-background-2 shadow-sm"
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
        <span className="ms-2 text-1 font-medium text-muted-foreground">
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
    <div className="craft-card px-3 py-2.5">
      <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <MembershipStack members={members} emptyLabel={emptyLabel} />
    </div>
  );
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

  if (isLoading && individuals.length === 0 && memberSpaces.length === 0) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-3"
        role="status"
        aria-live="polite"
      >
        {(['individuals', 'memberSpaces', 'agents'] as const).map((key) => (
          <div key={key} className="craft-card px-3 py-2.5">
            <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
              {t(`navigation.${key}`)}
            </p>
            <p className="craft-meta">{t('navigation.loading')}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <MembershipModuleCard
        label={t('navigation.individuals')}
        members={individuals}
        emptyLabel={t('navigation.noIndividuals')}
      />
      <MembershipModuleCard
        label={t('navigation.memberSpaces')}
        members={memberSpaces}
        emptyLabel={t('navigation.noMemberSpaces')}
      />
      <MembershipModuleCard
        label={t('navigation.agents')}
        members={agents}
        emptyLabel={t('navigation.noAgents')}
      />
    </div>
  );
}
