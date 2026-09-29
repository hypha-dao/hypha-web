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

/** `h-8` / `w-8` — theme `--spacing-8` is 48px, not the default 32px scale. */
const AVATAR_SIZE_PX = 48;
/** `-space-x-2` overlap between circles in the stack. */
const AVATAR_OVERLAP_PX = 8;
/**
 * Clear space after the last circle before +N.
 * Matches `gap-3` (theme `--spacing-3`). Avatars still overlap each other.
 */
const COUNT_GAP_PX = 12;
/** Width reserved for the "+NNN" label itself, not including COUNT_GAP_PX. */
const OVERFLOW_COUNT_RESERVE_PX = 40;
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
  /** Current space name — vertically centered on the label and avatar group. */
  spaceTitle?: string;
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
    const badgeWidth =
      count < total ? COUNT_GAP_PX + OVERFLOW_COUNT_RESERVE_PX : 0;
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
    return <p className="craft-meta text-pretty md:truncate">{emptyLabel}</p>;
  }

  const visible = members.slice(0, visibleCount);
  const overflow = members.length - visible.length;

  return (
    <div
      ref={containerRef}
      className="flex w-full min-h-8 min-w-0 items-center gap-3"
    >
      <div className="flex min-w-0 overflow-hidden -space-x-2">
        {visible.map((member) =>
          member.accentClassName ? (
            <div
              key={member.id}
              title={member.label}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold ${member.accentClassName}`}
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
        <span className="shrink-0 text-1 font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

const MODULE_COLUMN_START = [
  'md:col-start-2',
  'md:col-start-3',
  'md:col-start-4',
] as const;

/** Shared by the label and avatar cells so the desktop column divider stays continuous. */
function membershipColumnClass(index: number, count: number): string {
  if (index <= 0) return 'min-w-0 md:pe-4';
  if (index >= count - 1) {
    return 'min-w-0 md:border-s md:border-border/50 md:ps-4 md:pe-2';
  }
  return 'min-w-0 md:border-s md:border-border/50 md:px-4';
}

/**
 * Below md the space name and actions share one line and the three groups
 * stack under that name. From md up, one row: the name is vertically centered
 * on the label + avatar group, labels share a line, avatars sit under them.
 */
const MEMBERSHIP_ROW_CLASS =
  'flex min-w-0 flex-col gap-3 border-b border-border/50 py-2.5 md:grid md:gap-0 md:overflow-x-auto md:[grid-template-columns:fit-content(14rem)_repeat(3,minmax(0,1fr))_auto]';

export function EcosystemMembershipModules({
  spaceSlug,
  spaceTitle,
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
    <div
      className={MEMBERSHIP_ROW_CLASS}
      role={isLoading ? 'status' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
        {spaceTitle ? (
          <p
            className="craft-page-title min-w-0 flex-1 truncate text-4 font-medium md:col-start-1 md:row-span-2 md:row-start-1 md:max-w-56 md:flex-none md:self-center md:pe-4"
            title={spaceTitle}
          >
            {spaceTitle}
          </p>
        ) : null}
        {trailing ? (
          <div className="flex w-max shrink-0 items-center gap-1 md:col-start-5 md:row-span-2 md:row-start-1 md:self-center">
            {trailing}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3 md:contents">
        {modules.map((module, index) => {
          const columnClass = `${membershipColumnClass(
            index,
            modules.length,
          )} ${MODULE_COLUMN_START[index]}`;
          const showLoading =
            isLoading && module.key !== 'agents' && module.members.length === 0;

          return (
            <div
              key={module.key}
              className="flex min-w-0 flex-col gap-1.5 md:contents"
            >
              <p
                className={`${columnClass} text-1 font-medium uppercase tracking-wide text-muted-foreground md:row-start-1 md:self-baseline`}
              >
                {module.label}
              </p>
              <div className={`${columnClass} md:row-start-2 md:pt-1.5`}>
                {showLoading ? (
                  <p className="craft-meta">{t('navigation.loading')}</p>
                ) : (
                  <MembershipStack
                    members={module.members}
                    emptyLabel={module.emptyLabel}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
