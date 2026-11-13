import { getImageProps } from 'next/image';
import {
  SpaceCallJoinHeroBanner,
  SpaceModeLabel,
  SpaceSettingsButton,
  SubscriptionBadge,
  SpaceAccentPortalBridge,
  SpaceCreatedOnText,
  isLikelyGifSrc,
  isSafeImageUrl,
  SPACE_BANNER_IMAGE_QUALITY,
  SPACE_BANNER_IMAGE_SIZES,
} from '@hypha-platform/epics';
import '../../_shared/space-accent.css';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from './@tab/agreements/constants';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';
import { LiveSpaceHeroBanner } from './_components/live-space-hero-with-counts';
import { DhoStickySpaceChrome } from './_components/dho-sticky-space-chrome';
import { SpaceMainNav } from './_components/space-main-nav';
import { SpaceActivityGatedBanners } from './_components/space-activity-gated-banners';
import { SpaceMembershipCtaUnderHero } from './_components/space-membership-cta-under-hero';

function sizedHeroBannerPreload(href: string) {
  if (!href || href === DEFAULT_SPACE_LEAD_IMAGE || isLikelyGifSrc(href)) {
    return null;
  }
  try {
    const { props } = getImageProps({
      src: href,
      alt: '',
      width: 1280,
      height: 480,
      sizes: SPACE_BANNER_IMAGE_SIZES,
      quality: SPACE_BANNER_IMAGE_QUALITY,
    });
    return (
      <link
        rel="preload"
        as="image"
        href={props.src}
        imageSrcSet={props.srcSet}
        imageSizes={props.sizes}
        fetchPriority="high"
      />
    );
  } catch (error) {
    console.error('Failed to build sized hero banner preload:', error);
    return null;
  }
}

export default async function DhoLayout({
  aside,
  children,
  tab,
  params,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
  tab: React.ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const tCommon = await getTranslations('Common');

  const spaceFromDb = await findSpaceBySlug({ slug: daoSlug }, { db });
  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId =
    typeof spaceFromDb.web3SpaceId === 'number'
      ? spaceFromDb.web3SpaceId
      : undefined;
  const spaceFlags = spaceFromDb.flags ?? [];

  const rawLead = spaceFromDb.leadImage?.trim();
  const heroBannerImageHref =
    rawLead && isSafeImageUrl(rawLead) ? rawLead : DEFAULT_SPACE_LEAD_IMAGE;

  const rawLogo = spaceFromDb.logoUrl?.trim();
  const accentLogoHref =
    rawLogo && isSafeImageUrl(rawLogo) ? rawLogo : DEFAULT_SPACE_AVATAR_IMAGE;

  // Member count is not archive state. A space that was just created has no
  // indexed members yet, and that was painting the Archived badge until reload.
  const compactBannerSpaceArchived = spaceFlags.includes('archived');

  return (
    <SpaceAccentPortalBridge>
      {/*
        Main column must span the full width next to side panels: `Container` max-width + `mx-auto`
        centers content and leaves empty gutters — very visible when the Human chat panel narrows
        the column (reads as a dead strip beside the hero / secondary chrome). Use padding only.
      */}
      <div className="flex w-full min-w-0">
        {/*
          `--hypha-space-scroll-hold` is set for the length of an in-space
          screen change. Min-height keeps the scrollport from clamping to the
          cover while the tab slot is a short loading skeleton. Padding on the
          flex scrollport does not extend scrollHeight.
        */}
        <div
          data-space-scroll-hold=""
          className="mt-[2px] min-w-0 flex-1 px-4 md:mt-[6px] sm:px-5"
          style={{ minHeight: 'var(--hypha-space-scroll-hold, 0px)' }}
        >
          {/* Overview portals the mycelium into this host. It stays behind the column:
              a sticky z-0 layer paints over later in-flow content, which hid the
              renewal banner under the marble and left only its buttons visible. */}
          <div
            data-space-ground=""
            className="pointer-events-none sticky top-0 z-0 h-0"
          />
          <div className="relative z-[1]">
            {/* React 19+: link rel="preload" is hoisted to document head.
                Sized /_next/image URL only — never the UploadThing original. */}
            {sizedHeroBannerPreload(heroBannerImageHref)}
            <DhoStickySpaceChrome
              title={spaceFromDb.title}
              logoUrl={accentLogoHref}
              logoAlt={spaceFromDb.title}
              defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
              actionsSlot={
                <>
                  <SpaceSettingsButton
                    href={`${getDhoPathAgreements(
                      lang,
                      daoSlug,
                    )}/select-settings-action`}
                    variant="chrome"
                    className="me-3"
                  />
                  {web3SpaceId !== undefined && (
                    <SubscriptionBadge
                      web3SpaceId={web3SpaceId}
                      className="rounded-none"
                    />
                  )}
                  <SpaceModeLabel
                    web3SpaceId={web3SpaceId}
                    isSandbox={spaceFlags.includes('sandbox')}
                    isDemo={spaceFlags.includes('demo')}
                    isArchived={compactBannerSpaceArchived}
                    configPath={`${getDhoPathAgreements(
                      lang,
                      daoSlug,
                    )}/space-configuration`}
                    className={
                      compactBannerSpaceArchived
                        ? '[&_.border-error-8]:rounded-none [&_.border-error-8]:border-error-8! [&_.border-error-8]:bg-transparent [&_.border-error-8]:text-foreground [&_.border-error-8]:hover:border-error-9! [&_.border-error-8]:hover:bg-transparent'
                        : '[&_.border-accent-8]:rounded-none [&_.border-accent-8]:border-accent-8! [&_.border-accent-8]:bg-transparent [&_.border-accent-8]:text-foreground [&_.border-accent-8]:hover:border-accent-9! [&_.border-accent-8]:hover:bg-transparent'
                    }
                  />
                </>
              }
              banner={
                <LiveSpaceHeroBanner
                  web3SpaceId={spaceFromDb.web3SpaceId}
                  spaceSlug={daoSlug}
                  title={spaceFromDb.title}
                  description={spaceFromDb.description}
                  logoUrl={accentLogoHref}
                  logoAlt={spaceFromDb.title}
                  defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
                  links={spaceFromDb.links}
                  leadImageUrl={heroBannerImageHref}
                  defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
                  memberCount={null}
                  agreementCount={null}
                  createdOnText={
                    <SpaceCreatedOnText createdAt={spaceFromDb.createdAt} />
                  }
                  membersLabel={tCommon('Members')}
                  agreementsLabel={tCommon('Agreements')}
                  descriptionLabel={tCommon('spaceBannerDescriptionAria', {
                    title: spaceFromDb.title,
                  })}
                  revealMetaLabel={tCommon('spaceBannerRevealMeta')}
                  footerTrailing={
                    <>
                      <SpaceSettingsButton
                        href={`${getDhoPathAgreements(
                          lang,
                          daoSlug,
                        )}/select-settings-action`}
                        variant="hero"
                        className="me-3"
                      />
                      {web3SpaceId !== undefined && (
                        <SubscriptionBadge
                          web3SpaceId={web3SpaceId}
                          onHeroBackground
                          className="rounded-none"
                        />
                      )}
                      <SpaceModeLabel
                        web3SpaceId={web3SpaceId}
                        isSandbox={spaceFlags.includes('sandbox')}
                        isDemo={spaceFlags.includes('demo')}
                        isArchived={compactBannerSpaceArchived}
                        configPath={`${getDhoPathAgreements(
                          lang,
                          daoSlug,
                        )}/space-configuration`}
                        className={
                          compactBannerSpaceArchived
                            ? '[&_.border-error-8]:rounded-none [&_.border-error-8]:border-error-8! [&_.border-error-8]:bg-transparent [&_.border-error-8]:text-white [&_.border-error-8]:hover:border-error-9! [&_.border-error-8]:hover:bg-transparent'
                            : '[&_.border-accent-8]:rounded-none [&_.border-accent-8]:border-accent-8! [&_.border-accent-8]:bg-transparent [&_.border-accent-8]:text-white [&_.border-accent-8]:hover:border-accent-9! [&_.border-accent-8]:hover:bg-transparent'
                        }
                      />
                    </>
                  }
                  beforeBanner={
                    <SpaceCallJoinHeroBanner
                      spaceSlug={daoSlug}
                      chatRoomId={spaceFromDb.chatRoomId}
                      web3SpaceId={web3SpaceId}
                      spaceTitle={spaceFromDb.title}
                    />
                  }
                />
              }
            />
            <SpaceMainNav lang={lang} id={daoSlug} />
            <div className="mt-1 flex flex-col gap-3">
              <SpaceActivityGatedBanners
                web3SpaceId={web3SpaceId}
                spaceDbId={spaceFromDb.id}
                spaceSlug={daoSlug}
                lang={lang}
              />
              {web3SpaceId !== undefined ? (
                <SpaceMembershipCtaUnderHero
                  spaceId={spaceFromDb.id}
                  web3SpaceId={web3SpaceId}
                  spaceSlug={daoSlug}
                />
              ) : null}
            </div>
            {tab}
            {children}
          </div>
        </div>
        {aside}
      </div>
    </SpaceAccentPortalBridge>
  );
}
