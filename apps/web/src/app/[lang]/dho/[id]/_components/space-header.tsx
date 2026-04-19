import {
  JoinSpace,
  SalesBanner,
  SpaceModeLabel,
  WebLinks,
  SubscriptionBadge,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import Image from 'next/image';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { ActionButtons } from './action-buttons';
import { NestedSpacesButton } from './nested-spaces-button';
import { Breadcrumbs } from './breadcrumbs';
import { canConvertToBigInt, cn, formatDate } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

export type SpaceHeaderProps = {
  lang: Locale;
  daoSlug: string;
  spaceId: number;
  web3SpaceId: number | null;
  title: string;
  description: string | null;
  links?: string[] | null;
  logoUrl?: string | null;
  leadImage?: string | null;
  createdAt: Date;
  flags: string[];
  spaceMembers: number;
  spaceAgreements: number;
};

export async function SpaceHeader({
  lang,
  daoSlug,
  spaceId,
  web3SpaceId,
  title,
  description,
  links,
  logoUrl,
  leadImage,
  createdAt,
  flags,
  spaceMembers,
  spaceAgreements,
}: SpaceHeaderProps) {
  const tCommon = await getTranslations('Common');
  const tSpaces = await getTranslations('Spaces');
  const leadSrc = leadImage || DEFAULT_SPACE_LEAD_IMAGE;
  const purposeText = description?.trim() ?? '';
  const hasPurpose = purposeText.length > 0;

  return (
    <header className="mb-6 space-y-4" aria-labelledby="space-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Breadcrumbs spaceId={spaceId} lang={lang} />
        {typeof web3SpaceId === 'number' && (
          <NestedSpacesButton web3SpaceId={web3SpaceId} spaceSlug={daoSlug} />
        )}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-neutral-6',
          'bg-card shadow-lg',
        )}
      >
        {/* Brand strip — full-width cover + layered gradients for depth */}
        <div className="relative isolate h-[92px] sm:h-[104px] md:h-[118px]">
          <Image
            src={leadSrc}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-2 from-[8%] via-neutral-3/55 via-[55%] to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-11/35 via-transparent to-accent-9/25"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_-10%,rgba(99,102,241,0.28),transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neutral-8/80 to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <Avatar
              className={cn(
                'z-10 -mt-12 h-[72px] w-[72px] shrink-0 rounded-2xl ring-[3px] ring-neutral-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.65)] sm:-mt-14 sm:h-[84px] sm:w-[84px] sm:ring-4',
              )}
            >
              <AvatarImage
                src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                alt=""
                aria-hidden
                className="object-cover"
              />
            </Avatar>

            <div className="min-w-0 flex-1 space-y-3 sm:pt-1">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
                <div className="min-w-0 flex-1 space-y-1">
                  <Text
                    id="space-title"
                    className="text-balance text-6 font-semibold tracking-tight sm:text-7"
                  >
                    {title}
                  </Text>
                  <WebLinks links={links} />
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                  {typeof web3SpaceId === 'number' ? (
                    <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
                  ) : null}
                  <ActionButtons web3SpaceId={web3SpaceId as number} />
                </div>
              </div>

              {/* Purpose — explicit label + body copy for clarity */}
              <div className="rounded-xl border border-neutral-6 bg-neutral-2/80 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-11">
                  {tSpaces('purpose')}
                </div>
                {hasPurpose ? (
                  <p className="text-pretty text-2 leading-relaxed text-neutral-12">
                    {purposeText}
                  </p>
                ) : (
                  <p className="text-2 italic leading-relaxed text-neutral-10">
                    {tSpaces('purposeEmptyPublic')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-neutral-6 pt-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-1 text-neutral-11">
                  <span className="inline-flex items-baseline gap-1 rounded-md bg-neutral-3/80 px-2 py-0.5">
                    <span className="font-semibold tabular-nums text-foreground">
                      {spaceMembers}
                    </span>
                    <span>{tCommon('Members')}</span>
                  </span>
                  <span className="text-neutral-8" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex items-baseline gap-1 rounded-md bg-neutral-3/80 px-2 py-0.5">
                    <span className="font-semibold tabular-nums text-foreground">
                      {spaceAgreements}
                    </span>
                    <span>{tCommon('Agreements')}</span>
                  </span>
                  <span className="text-neutral-8" aria-hidden>
                    ·
                  </span>
                  <span className="text-neutral-11">
                    {tCommon('createdOn', {
                      date: formatDate(createdAt, true),
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canConvertToBigInt(web3SpaceId) ? (
                    <SubscriptionBadge web3SpaceId={web3SpaceId as number} />
                  ) : null}
                  <SpaceModeLabel
                    web3SpaceId={web3SpaceId as number}
                    isSandbox={flags.includes('sandbox')}
                    isDemo={flags.includes('demo')}
                    isArchived={
                      flags.includes('archived') || spaceMembers === 0
                    }
                    configPath={`${getDhoPathAgreements(
                      lang,
                      daoSlug,
                    )}/space-configuration`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <SalesBanner web3SpaceId={web3SpaceId as number} />
      </div>
    </header>
  );
}
