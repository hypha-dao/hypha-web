import * as React from 'react';
import { LinkIcon } from '../../common/link-icon';
import { LinkLabel } from '../../common/link-label';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { CompactSpaceBannerLead } from './compact-space-banner-lead';
import { isSafeExternalUrl, isSafeImageUrl } from '../utils/safe-image-url';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from '../../common/chrome-radius';

export { APP_CHROME_SUBTLE_SQUARE_RADIUS };

/** Matches PR #2165 `SpaceHeaderInsetAvatar` footprint — shared with DHO sticky chrome row */
export const COMPACT_SPACE_BANNER_AVATAR_CLASSNAME = cn(
  'h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]',
  'shadow-md ring-1 ring-white/12',
);

/** Title size on the banner — reuse on sticky; heading face + regular weight for calmer hero */
export const COMPACT_SPACE_BANNER_TITLE_CLASSNAME = cn(
  'text-balance text-6 font-medium tracking-tight sm:text-7',
  '[font-family:var(--font-family-text)]',
);

/** Smaller footprint for the DHO sticky space chrome row — circular logo like the hero banner */
export const STICKY_SPACE_CHROME_AVATAR_CLASSNAME = cn(
  'h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11',
  'ring-1 ring-border/60 shadow-sm',
);

export const STICKY_SPACE_CHROME_TITLE_CLASSNAME = cn(
  'text-balance text-4 font-medium tracking-tight sm:text-5',
  '[font-family:var(--font-family-text)]',
);

/** Purpose column — max four lines on narrow viewports (scroll); sm+ wider column + taller cap. */
const DESCRIPTION_SCROLL_BOX = cn(
  'w-full max-w-full min-h-0 lg:max-w-[50%]',
  /* Mobile: two-line cap — no inner scroll chrome (saves ~half the card height) */
  'max-md:max-h-[2lh] max-md:overflow-hidden',
  /* md+: scrollable up to four lines */
  'md:max-h-[4lh] md:overflow-y-auto md:overscroll-y-contain md:touch-pan-y',
  'text-2 leading-[1.5]',
  '[scrollbar-gutter:stable]',
  '[scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent',
);

type CompactSpaceBannerCommon = {
  title: string;
  description: string | null | undefined;
  logoUrl: string | null | undefined;
  logoAlt: string;
  defaultLogoSrc: string;
  links?: string[] | null;
  leadImageUrl?: string | null;
  defaultLeadImageSrc?: string;
  /** Localized accessible name for the description region (screen readers). */
  descriptionLabel: string;
  footerTrailing?: React.ReactNode;
  className?: string;
};

export type CompactSpaceBannerWithStatsProps = CompactSpaceBannerCommon & {
  showSpaceStats?: true;
  memberCount: number | null;
  agreementCount: number | null;
  createdOnText: React.ReactNode;
  membersLabel: string;
  agreementsLabel: string;
};

export type CompactSpaceBannerProfileProps = CompactSpaceBannerCommon & {
  showSpaceStats: false;
  /** Renders before the hairline (e.g. member since, email) */
  footerLeading?: React.ReactNode;
};

export type CompactSpaceBannerProps =
  | CompactSpaceBannerWithStatsProps
  | CompactSpaceBannerProfileProps;

function isSpaceWithStats(
  p: CompactSpaceBannerProps,
): p is CompactSpaceBannerWithStatsProps {
  return p.showSpaceStats !== false;
}

export function CompactSpaceBanner(props: CompactSpaceBannerProps) {
  const {
    title,
    description,
    logoUrl,
    logoAlt,
    defaultLogoSrc,
    links,
    leadImageUrl,
    defaultLeadImageSrc,
    descriptionLabel,
    footerTrailing,
    className,
  } = props;
  const showSpaceStats = isSpaceWithStats(props);
  const footerLeading = !showSpaceStats
    ? (props as CompactSpaceBannerProfileProps).footerLeading
    : undefined;
  const memberCount = showSpaceStats ? props.memberCount : null;
  const agreementCount = showSpaceStats ? props.agreementCount : null;
  const createdOnText = showSpaceStats ? props.createdOnText : '';
  const membersLabel = showSpaceStats ? props.membersLabel : '';
  const agreementsLabel = showSpaceStats ? props.agreementsLabel : '';
  const textureSrc = (() => {
    const lead = leadImageUrl?.trim();
    const fallback = defaultLeadImageSrc?.trim() ?? '';
    if (lead && isSafeImageUrl(lead)) return lead;
    if (fallback && isSafeImageUrl(fallback)) return fallback;
    return '';
  })();

  const safeLinks =
    links?.filter((l) => typeof l === 'string' && isSafeExternalUrl(l)) ?? [];

  const safeLogoSrc = (() => {
    const candidate = logoUrl?.trim();
    if (candidate && isSafeImageUrl(candidate)) return candidate;
    return isSafeImageUrl(defaultLogoSrc) ? defaultLogoSrc : '';
  })();

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-lg border border-border/70',
        'shadow-md',
        /* Bottom breathing room lives on the footer strip so metadata + badges center between hairline and card edge */
        'px-4 pt-4 pb-0 md:px-8 md:pt-8',
        className,
      )}
      aria-label={title}
    >
      {/* Lead image — Image + preload avoids grey decode flash; overlays unchanged */}
      {textureSrc ? (
        <>
          <CompactSpaceBannerLead src={textureSrc} />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-white dark:bg-black"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_8%,rgba(255,255,255,0.16),transparent_62%)] dark:bg-[radial-gradient(ellipse_55%_45%_at_80%_8%,rgba(255,255,255,0.06),transparent_62%)]"
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-3 md:gap-5">
        {/* Row 1: avatar + title/links — avatar size matches PR #2165 */}
        <div className="flex flex-wrap items-center gap-3 md:items-start md:gap-4 sm:gap-6">
          <Avatar
            className={cn(
              COMPACT_SPACE_BANNER_AVATAR_CLASSNAME,
              'max-md:h-11 max-md:w-11 max-md:shadow-sm',
            )}
          >
            <AvatarImage
              src={safeLogoSrc}
              alt={logoAlt}
              className="object-cover"
            />
          </Avatar>

          <div className="min-w-0 flex-1 basis-[16rem] space-y-1 md:space-y-2">
            <h1
              className={cn(
                COMPACT_SPACE_BANNER_TITLE_CLASSNAME,
                'text-white drop-shadow-sm max-md:text-5',
              )}
            >
              {title}
            </h1>
            {safeLinks.length > 0 ? (
              <div className="hidden flex-wrap gap-x-5 gap-y-2 md:flex">
                {safeLinks.map((link, index) => (
                  <a
                    key={`${link}_${index}`}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-1 text-white/80 hover:text-white"
                  >
                    <span className="text-white/80 [&_svg]:h-4 [&_svg]:w-4">
                      <LinkIcon url={link} />
                    </span>
                    <LinkLabel
                      url={link}
                      className="underline-offset-4 hover:underline"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Below header: same horizontal origin as avatar — not nested in title column */}
        {description ? (
          <div
            role="region"
            aria-label={descriptionLabel}
            tabIndex={0}
            className={cn(
              DESCRIPTION_SCROLL_BOX,
              'outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
            )}
          >
            <p className="text-pretty text-2 leading-[1.5] text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)] max-md:line-clamp-2">
              {description}
            </p>
          </div>
        ) : null}

        {/* Hairline + metadata: one flex item so gap-5 does not double-space above the strip */}
        {footerLeading || showSpaceStats || footerTrailing ? (
          <div className="flex flex-col">
            <div
              className="h-px w-full shrink-0 bg-white/12"
              role="presentation"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 md:gap-3 md:py-5">
              <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1 text-1 text-white/88 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                {footerLeading ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {footerLeading}
                  </div>
                ) : null}
                {footerLeading && showSpaceStats ? (
                  <span className="hidden text-white/45 sm:inline" aria-hidden>
                    ·
                  </span>
                ) : null}
                {showSpaceStats ? (
                  <>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="font-bold tabular-nums text-white">
                        {memberCount ?? '—'}
                      </span>{' '}
                      <span className="text-white/92">{membersLabel}</span>
                    </span>
                    <span className="text-white/45" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="font-bold tabular-nums text-white">
                        {agreementCount ?? '—'}
                      </span>{' '}
                      <span className="text-white/92">{agreementsLabel}</span>
                    </span>
                    <span
                      className="hidden text-white/45 md:inline"
                      aria-hidden
                    >
                      ·
                    </span>
                    <span className="text-white/88 max-md:hidden">
                      {createdOnText}
                    </span>
                  </>
                ) : null}
              </div>

              {footerTrailing ? (
                <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 [&_a]:inline-flex [&_a]:items-center [&_div]:inline-flex [&_div]:items-center">
                  {footerTrailing}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
