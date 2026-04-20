import {
  SpaceModeLabel,
  WebLinks,
  SubscriptionBadge,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';
import Image from 'next/image';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { canConvertToBigInt, cn, formatDate } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

import {
  SPACE_HEADER_HERO_H,
  SPACE_HEADER_PURPOSE_WRAP,
} from './space-header-constants';
import { SpaceHeaderHeroClip } from './space-header-hero-clip';
import { SPACE_HEADER_IDENTITY_TITLE_CLASS } from './space-header-identity-tokens';
import { SpaceHeaderInsetAvatar } from './space-header-inset-avatar';

type SpaceHeaderHeroCardProps = {
  lang: Locale;
  daoSlug: string;
  title: string;
  links?: string[] | null;
  logoUrl?: string | null;
  leadImage?: string | null;
  createdAt: Date;
  flags: string[];
  spaceMembers: number;
  spaceAgreements: number;
  web3SpaceId: number | null;
  /** Pre-truncated purpose for display */
  purposeDisplay: string;
  rawPurpose: string;
  hasPurpose: boolean;
};

export async function SpaceHeaderHeroCard({
  lang,
  daoSlug,
  title,
  links,
  logoUrl,
  leadImage,
  createdAt,
  flags,
  spaceMembers,
  spaceAgreements,
  web3SpaceId,
  purposeDisplay,
  rawPurpose,
  hasPurpose,
}: SpaceHeaderHeroCardProps) {
  const tCommon = await getTranslations('Common');
  const tSpaces = await getTranslations('Spaces');
  const leadSrc = leadImage || DEFAULT_SPACE_LEAD_IMAGE;

  return (
    <div className="relative mb-0">
      <div
        data-space-hero-card
        className={cn(
          'relative isolate flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-6 shadow-md',
          SPACE_HEADER_HERO_H,
        )}
      >
        <SpaceHeaderHeroClip className="absolute inset-0 z-0">
          <div className="relative h-full w-full overflow-hidden rounded-2xl">
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
          </div>
        </SpaceHeaderHeroClip>

        <div className="relative z-[25] flex h-full min-h-0 flex-col overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex shrink-0 items-start gap-3.5 sm:gap-4">
            <SpaceHeaderInsetAvatar
              src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <Text
                id="space-title"
                className={SPACE_HEADER_IDENTITY_TITLE_CLASS}
              >
                {title}
              </Text>
              <div className="[&_a]:text-white/90 [&_a:hover]:text-white [&_svg]:text-white/75">
                <WebLinks links={links} />
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-3 pb-4 sm:py-4 sm:pb-5">
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1',
                SPACE_HEADER_PURPOSE_WRAP,
              )}
              style={{ scrollbarWidth: 'thin' }}
            >
              <div>
                {hasPurpose ? (
                  <p
                    className="text-pretty text-[15px] leading-relaxed text-white/95 sm:text-2 sm:leading-relaxed"
                    title={
                      purposeDisplay !== rawPurpose ? rawPurpose : undefined
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
          </div>

          <div className="shrink-0 border-t border-white/15 pt-4 sm:pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] leading-snug text-white/88 sm:text-1">
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
              <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
                {canConvertToBigInt(web3SpaceId) ? (
                  <SubscriptionBadge
                    web3SpaceId={web3SpaceId as number}
                    forDarkBackground
                  />
                ) : null}
                {typeof web3SpaceId === 'number' ? (
                  <SpaceModeLabel
                    web3SpaceId={web3SpaceId}
                    isSandbox={flags.includes('sandbox')}
                    isDemo={flags.includes('demo')}
                    isArchived={
                      flags.includes('archived') || spaceMembers === 0
                    }
                    configPath={`${getDhoPathAgreements(
                      lang,
                      daoSlug,
                    )}/space-configuration`}
                    forDarkBackground
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
