'use client';

import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Image,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { ArrowTopRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import type { EcosystemMemberPreview } from './types';
import { MYCELIUM } from './mycelium-theme';

type SpaceFocusCardProps = {
  title: string;
  logoUrl?: string | null;
  description?: string | null;
  breadcrumb: string[];
  personMembers: EcosystemMemberPreview[];
  spaceMembers: EcosystemMemberPreview[];
  visitHref?: string | null;
  addHref?: string | null;
  canVisit?: boolean;
  canAdd?: boolean;
  accentHex?: string;
  memberCount?: number;
};

function MemberStack({
  members,
  emptyLabel,
}: {
  members: EcosystemMemberPreview[];
  emptyLabel: string;
}) {
  if (members.length === 0) {
    return <p className="text-1 text-muted-foreground">{emptyLabel}</p>;
  }

  const visible = members.slice(0, 8);
  const overflow = members.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <Avatar
            key={member.id}
            className="h-8 w-8 rounded-full border-2 border-background shadow-sm"
            title={member.label}
          >
            <AvatarImage
              className="rounded-full object-cover"
              src={member.imageUrl || undefined}
            />
            <AvatarFallback className="rounded-full text-[10px]">
              {member.label.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {overflow > 0 ? (
        <span className="ms-2 text-1 font-medium text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function SpaceFocusCard({
  title,
  logoUrl,
  description,
  breadcrumb,
  personMembers,
  spaceMembers,
  visitHref,
  addHref,
  canVisit,
  canAdd,
  accentHex = MYCELIUM.accent,
  memberCount,
}: SpaceFocusCardProps) {
  const t = useTranslations('SelectNavigationAction');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/55 bg-background/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${accentHex}, transparent 85%)`,
        }}
      />

      {breadcrumb.length > 0 ? (
        <nav
          aria-label={t('navigation.breadcrumb')}
          className="mb-3 flex flex-wrap items-center gap-1.5 text-1 text-muted-foreground"
        >
          {breadcrumb.map((crumb, index) => (
            <span
              key={`${crumb}-${index}`}
              className="inline-flex items-center gap-1.5"
            >
              {index > 0 ? <span aria-hidden>/</span> : null}
              <span
                className={
                  index === breadcrumb.length - 1
                    ? 'font-medium text-foreground'
                    : undefined
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <div
            className="absolute -inset-1 rounded-2xl opacity-40 blur-md"
            style={{ backgroundColor: accentHex }}
            aria-hidden
          />
          <Image
            src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
            alt={title}
            width={72}
            height={72}
            className="relative h-[72px] w-[72px] rounded-2xl border border-border/60 object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-5 font-semibold tracking-tight text-foreground">
                {title}
              </h2>
              {typeof memberCount === 'number' ? (
                <p className="mt-0.5 text-1 text-muted-foreground">
                  {t('navigation.memberCount', { count: memberCount })}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              {canVisit && visitHref ? (
                <Tooltip delayDuration={80}>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      colorVariant="neutral"
                      className="h-8 gap-1.5 px-2.5"
                    >
                      <Link href={visitHref}>
                        <ArrowTopRightIcon />
                        <span className="text-1">
                          {t('visibleSpaces.visitSpace')}
                        </span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('visibleSpaces.visitSpace')}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {canAdd && addHref ? (
                <Tooltip delayDuration={80}>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      colorVariant="neutral"
                      className="h-8 w-8 p-0"
                      aria-label={t('visibleSpaces.addSpace')}
                    >
                      <Link href={addHref}>
                        <PlusIcon />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('visibleSpaces.addSpace')}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>

          {description ? (
            <p className="mt-2 line-clamp-2 text-2 text-muted-foreground">
              {description}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/45 bg-background-3/50 px-3 py-2.5">
              <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
                {t('navigation.individuals')}
              </p>
              <MemberStack
                members={personMembers}
                emptyLabel={t('navigation.noIndividuals')}
              />
            </div>
            <div className="rounded-xl border border-border/45 bg-background-3/50 px-3 py-2.5">
              <p className="mb-2 text-1 font-medium uppercase tracking-wide text-muted-foreground">
                {t('navigation.memberSpaces')}
              </p>
              <MemberStack
                members={spaceMembers}
                emptyLabel={t('navigation.noMemberSpaces')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
