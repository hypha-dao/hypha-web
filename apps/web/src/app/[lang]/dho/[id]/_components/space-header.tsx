import {
  JoinSpace,
  SalesBanner,
  SpaceModeLabel,
  WebLinks,
  SubscriptionBadge,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Avatar, AvatarImage, Card } from '@hypha-platform/ui';
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
import { canConvertToBigInt, formatDate } from '@hypha-platform/ui-utils';
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
  const leadSrc = leadImage || DEFAULT_SPACE_LEAD_IMAGE;

  return (
    <header className="mb-6 space-y-4" aria-labelledby="space-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Breadcrumbs spaceId={spaceId} lang={lang} />
        {typeof web3SpaceId === 'number' && (
          <NestedSpacesButton web3SpaceId={web3SpaceId} spaceSlug={daoSlug} />
        )}
      </div>

      <Card className="overflow-hidden border border-neutral-6 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex shrink-0 gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 rounded-xl ring-2 ring-neutral-6 sm:h-[72px] sm:w-[72px]">
              <AvatarImage src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE} alt="" />
            </Avatar>
            <div className="relative h-14 w-[5.5rem] shrink-0 overflow-hidden rounded-lg sm:h-[72px] sm:w-36">
              <Image
                src={leadSrc}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 88px, 144px"
                priority
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <Text id="space-title" className="text-6 sm:text-7">
                  {title}
                </Text>
                <WebLinks links={links} />
                {description ? (
                  <Text className="text-2 leading-snug text-neutral-11">
                    {description}
                  </Text>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                {typeof web3SpaceId === 'number' ? (
                  <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceId} />
                ) : null}
                <ActionButtons web3SpaceId={web3SpaceId as number} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-6 pt-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-1">
                <span className="flex items-baseline gap-1">
                  <span className="font-semibold text-foreground">
                    {spaceMembers}
                  </span>
                  <span className="text-neutral-11">{tCommon('Members')}</span>
                </span>
                <span className="hidden text-neutral-8 sm:inline" aria-hidden>
                  ·
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="font-semibold text-foreground">
                    {spaceAgreements}
                  </span>
                  <span className="text-neutral-11">
                    {tCommon('Agreements')}
                  </span>
                </span>
                <span className="hidden text-neutral-8 sm:inline" aria-hidden>
                  ·
                </span>
                <span className="text-neutral-11">
                  {tCommon('createdOn', {
                    date: formatDate(createdAt, true),
                  })}
                </span>
              </div>
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
      </Card>

      <div className="mt-2">
        <SalesBanner web3SpaceId={web3SpaceId as number} />
      </div>
    </header>
  );
}
