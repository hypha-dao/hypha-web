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

const PURPOSE_MAX_CHARS = 300;

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
  const rawPurpose = description?.trim() ?? '';
  const purposeDisplay =
    rawPurpose.length > PURPOSE_MAX_CHARS
      ? `${rawPurpose.slice(0, PURPOSE_MAX_CHARS)}…`
      : rawPurpose;
  const hasPurpose = purposeDisplay.length > 0;

  return (
    <header className="mb-5 space-y-3" aria-labelledby="space-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Breadcrumbs spaceId={spaceId} lang={lang} />
        {typeof web3SpaceId === 'number' && (
          <NestedSpacesButton web3SpaceId={web3SpaceId} spaceSlug={daoSlug} />
        )}
      </div>

      {/* Avatar sits outside overflow-hidden banner so it can hang below the rounded rect */}
      <div className="relative mb-[4.25rem]">
        <div
          className={cn(
            'relative isolate flex h-[270px] min-h-[270px] max-h-[270px] w-full flex-col overflow-hidden rounded-2xl border border-neutral-6 shadow-md',
          )}
        >
          <Image
            src={leadSrc}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1280px) 100vw, 1280px"
            aria-hidden
          />

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/42 via-[52%] to-black/22"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/58 via-transparent to-black/40"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-11/18 via-transparent to-transparent"
            aria-hidden
          />

          <div className="relative z-[1] flex h-full min-h-0 flex-col px-5 py-5 sm:px-7 sm:py-6">
            {/* Identity + actions */}
            <div className="flex shrink-0 flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
              <div
                className={cn(
                  'min-w-0 flex-1 space-y-2',
                  'pl-[128px] sm:pl-[136px]',
                )}
              >
                <Text
                  id="space-title"
                  className="text-balance text-6 font-semibold tracking-tight text-white drop-shadow-sm sm:text-7"
                >
                  {title}
                </Text>
                <div className="[&_a]:text-white/90 [&_a:hover]:text-white [&_svg]:text-white/75">
                  <WebLinks links={links} />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end xl:pt-0.5">
                {typeof web3SpaceId === 'number' ? (
                  <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
                ) : null}
                <ActionButtons web3SpaceId={web3SpaceId as number} />
              </div>
            </div>

            {/* Purpose — full width, vertically centred in remaining banner height */}
            <div className="flex min-h-0 flex-1 flex-col justify-center py-3 sm:py-4">
              <div className="w-full min-w-0 space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/60 sm:text-[11px]">
                  {tSpaces('purpose')}
                </div>
                {hasPurpose ? (
                  <p
                    className="max-h-[9.5rem] w-full overflow-y-auto text-pretty text-[15px] leading-relaxed text-white/95 sm:text-2 sm:leading-relaxed"
                    style={{ scrollbarWidth: 'thin' }}
                    title={
                      rawPurpose.length > PURPOSE_MAX_CHARS
                        ? rawPurpose
                        : undefined
                    }
                  >
                    {purposeDisplay}
                  </p>
                ) : (
                  <p className="text-pretty text-2 italic leading-relaxed text-white/60">
                    {tSpaces('purposeEmptyPublic')}
                  </p>
                )}
              </div>
            </div>

            {/* Stats + badges */}
            <div className="shrink-0 space-y-3 border-t border-white/15 pt-3 sm:pt-4">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] leading-snug text-white/88 sm:text-1">
                <span>
                  <span className="font-semibold tabular-nums text-white">
                    {spaceMembers}
                  </span>{' '}
                  {tCommon('Members')}
                </span>
                <span className="text-white/35" aria-hidden>
                  ·
                </span>
                <span>
                  <span className="font-semibold tabular-nums text-white">
                    {spaceAgreements}
                  </span>{' '}
                  {tCommon('Agreements')}
                </span>
                <span className="text-white/35" aria-hidden>
                  ·
                </span>
                <span className="text-white/78">
                  {tCommon('createdOn', {
                    date: formatDate(createdAt, true),
                  })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                {canConvertToBigInt(web3SpaceId) ? (
                  <SubscriptionBadge web3SpaceId={web3SpaceId as number} />
                ) : null}
                <SpaceModeLabel
                  web3SpaceId={web3SpaceId as number}
                  isSandbox={flags.includes('sandbox')}
                  isDemo={flags.includes('demo')}
                  isArchived={flags.includes('archived') || spaceMembers === 0}
                  configPath={`${getDhoPathAgreements(
                    lang,
                    daoSlug,
                  )}/space-configuration`}
                />
              </div>
            </div>
          </div>
        </div>

        <Avatar
          className={cn(
            'absolute bottom-0 left-4 z-20 h-[128px] w-[128px] -translate-y-1/2 rounded-full sm:left-6',
            'shadow-[0_18px_44px_-10px_rgba(0,0,0,0.88)] ring-[4px] ring-neutral-2 dark:ring-neutral-3',
          )}
        >
          <AvatarImage
            src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
            alt=""
            aria-hidden
            className="object-cover"
          />
        </Avatar>
      </div>

      <div className="mt-1">
        <SalesBanner web3SpaceId={web3SpaceId as number} />
      </div>
    </header>
  );
}
