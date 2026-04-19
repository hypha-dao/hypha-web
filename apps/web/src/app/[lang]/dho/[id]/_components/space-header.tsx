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

/** Matches legacy live layout: `layout.tsx` used 768×270 lead image. */
const BANNER_HEIGHT_CLASS = 'h-[270px] min-h-[270px] max-h-[270px]';

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
          /* Avatar hangs ~93px below banner (128px − 35px offset) */
          'relative mb-24 overflow-visible rounded-2xl border border-neutral-6 shadow-lg',
        )}
      >
        {/* Banner + text overlay (live height 270px) + prod avatar overlap */}
        <div
          className={cn(
            'relative isolate w-full overflow-hidden rounded-2xl',
            BANNER_HEIGHT_CLASS,
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

          {/* Readability overlays — strong bottom wash + side vignette */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/35 via-[45%] to-black/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-11/25 via-transparent to-transparent"
            aria-hidden
          />

          {/* Foreground copy + actions */}
          <div className="relative z-[1] flex h-full flex-col justify-end p-4 pb-5 sm:p-6">
            <div className="flex min-h-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
              <div
                className={cn(
                  'min-w-0 flex-1 space-y-2',
                  /* Clear the circular avatar (128px + original left inset) */
                  'pl-[148px] sm:pl-[160px]',
                )}
              >
                <Text
                  id="space-title"
                  className="text-balance text-6 font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-7"
                >
                  {title}
                </Text>

                <div className="[&_a]:text-white/90 [&_a:hover]:text-white [&_svg]:text-white/80">
                  <WebLinks links={links} />
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">
                    {tSpaces('purpose')}
                  </div>
                  {hasPurpose ? (
                    <p className="text-pretty text-2 leading-snug text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]">
                      {purposeText}
                    </p>
                  ) : (
                    <p className="text-pretty text-2 italic leading-snug text-white/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                      {tSpaces('purposeEmptyPublic')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/20 pt-3 text-1 text-white/85">
                  <span>
                    <span className="font-semibold tabular-nums text-white">
                      {spaceMembers}
                    </span>{' '}
                    {tCommon('Members')}
                  </span>
                  <span className="text-white/45" aria-hidden>
                    ·
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums text-white">
                      {spaceAgreements}
                    </span>{' '}
                    {tCommon('Agreements')}
                  </span>
                  <span className="text-white/45" aria-hidden>
                    ·
                  </span>
                  <span className="text-white/80">
                    {tCommon('createdOn', {
                      date: formatDate(createdAt, true),
                    })}
                  </span>
                  {canConvertToBigInt(web3SpaceId) ? (
                    <>
                      <span
                        className="hidden text-white/45 sm:inline"
                        aria-hidden
                      >
                        ·
                      </span>
                      <SubscriptionBadge web3SpaceId={web3SpaceId as number} />
                    </>
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

              <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                {typeof web3SpaceId === 'number' ? (
                  <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
                ) : null}
                <ActionButtons web3SpaceId={web3SpaceId as number} />
              </div>
            </div>
          </div>

          {/* Avatar: match legacy prod offset — overlaps bottom edge */}
          <Avatar
            className={cn(
              'absolute bottom-[-35px] left-[15px] z-10 h-[128px] w-[128px] rounded-full',
              'shadow-[0_14px_40px_-6px_rgba(0,0,0,0.85)] ring-[4px] ring-neutral-2',
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
      </div>

      <div className="mt-2">
        <SalesBanner web3SpaceId={web3SpaceId as number} />
      </div>
    </header>
  );
}
