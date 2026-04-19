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

/** Banner height — full-frame hero within the layout (tighter than legacy 270px). */
const BANNER_HEIGHT =
  'min-h-[200px] h-[clamp(11rem,28vw,17rem)] sm:min-h-[240px]';

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
          'overflow-visible rounded-2xl border border-neutral-6 bg-card shadow-lg',
        )}
      >
        {/* Full-width banner + circular avatar overlapping bottom edge (prod pattern) */}
        <div className="relative">
          <div
            className={cn(
              'relative isolate w-full overflow-hidden rounded-t-2xl',
              BANNER_HEIGHT,
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
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-2/90 via-neutral-2/20 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-11/20 via-transparent to-transparent"
              aria-hidden
            />
          </div>

          <Avatar
            className={cn(
              'absolute bottom-0 left-4 z-10 h-[104px] w-[104px] translate-y-1/2 rounded-full',
              'ring-[4px] ring-neutral-2 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.75)] sm:left-6 sm:h-[112px] sm:w-[112px]',
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

        {/* Content: padding clears overlapping avatar — no nested bordered panels */}
        <div className="relative rounded-b-2xl px-4 pb-5 pt-[4.5rem] sm:px-6 sm:pt-[4.75rem]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
            <div className="min-w-0 flex-1 space-y-3 pl-32 sm:pl-36 lg:min-h-[4.25rem]">
              <Text
                id="space-title"
                className="text-balance text-6 font-semibold tracking-tight sm:text-7"
              >
                {title}
              </Text>
              <WebLinks links={links} />

              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-11">
                  {tSpaces('purpose')}
                </div>
                {hasPurpose ? (
                  <p className="text-pretty text-2 leading-relaxed text-neutral-12">
                    {purposeText}
                  </p>
                ) : (
                  <p className="text-pretty text-2 italic leading-relaxed text-neutral-10">
                    {tSpaces('purposeEmptyPublic')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-neutral-6 pt-4 text-1">
                <span className="text-neutral-11">
                  <span className="font-semibold tabular-nums text-foreground">
                    {spaceMembers}
                  </span>{' '}
                  {tCommon('Members')}
                </span>
                <span className="text-neutral-8" aria-hidden>
                  ·
                </span>
                <span className="text-neutral-11">
                  <span className="font-semibold tabular-nums text-foreground">
                    {spaceAgreements}
                  </span>{' '}
                  {tCommon('Agreements')}
                </span>
                <span className="text-neutral-8" aria-hidden>
                  ·
                </span>
                <span className="text-neutral-11">
                  {tCommon('createdOn', {
                    date: formatDate(createdAt, true),
                  })}
                </span>
                {canConvertToBigInt(web3SpaceId) ? (
                  <>
                    <span
                      className="hidden text-neutral-8 sm:inline"
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
                  isArchived={flags.includes('archived') || spaceMembers === 0}
                  configPath={`${getDhoPathAgreements(
                    lang,
                    daoSlug,
                  )}/space-configuration`}
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end xl:pt-1">
              {typeof web3SpaceId === 'number' ? (
                <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
              ) : null}
              <ActionButtons web3SpaceId={web3SpaceId as number} />
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
