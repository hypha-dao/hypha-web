import * as React from 'react';
import { LinkIcon } from '../../common/link-icon';
import { LinkLabel } from '../../common/link-label';
import { Avatar, AvatarFallback, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { CompactSpaceBannerLead } from './compact-space-banner-lead';
import { isSafeExternalUrl, isSafeImageUrl } from '../utils/safe-image-url';

/** Matches PR #2165 `SpaceHeaderInsetAvatar` footprint — shared with DHO sticky chrome row */
export const COMPACT_SPACE_BANNER_AVATAR_CLASSNAME = cn(
  'h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]',
  'shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15',
);

/** Title size on the banner — reuse on sticky; regular weight (no semibold) for calmer hero + chrome */
export const COMPACT_SPACE_BANNER_TITLE_CLASSNAME = cn(
  'text-balance text-6 font-normal tracking-tight sm:text-7',
  /* Use design-token text stack from packages/ui-utils @theme (--font-family-text) */
  '[font-family:var(--font-family-text),ui-sans-serif,system-ui,sans-serif]',
);

/**
 * Subtle square corners — matches outlined header controls (language, Space Settings) and small square avatars.
 * (~6px; not pill, not large card radius.)
 */
export const APP_CHROME_SUBTLE_SQUARE_RADIUS = 'rounded-[6px]';

/** Smaller footprint for the DHO sticky space chrome row — circular logo like the hero banner */
export const STICKY_SPACE_CHROME_AVATAR_CLASSNAME = cn(
  'h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11',
  'ring-1 ring-border/60 shadow-sm',
);

export const STICKY_SPACE_CHROME_TITLE_CLASSNAME = cn(
  'text-balance text-4 font-medium tracking-tight sm:text-5',
  '[font-family:var(--font-family-text),ui-sans-serif,system-ui,sans-serif]',
);

/** Purpose column — max four lines on narrow viewports (scroll); sm+ wider column + taller cap. */
const DESCRIPTION_SCROLL_BOX = cn(
  'w-full max-w-full min-h-0 max-h-[4lh] overflow-y-auto overscroll-y-contain touch-pan-y',
  'text-2 leading-[1.5] lg:max-w-[50%]',
  '[scrollbar-gutter:stable]',
  '[scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent',
);

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gradientHuesFromSeed(seed: string): [number, number, number] {
  const hash = hashSeed(seed || 'hypha');
  const h1 = hash % 360;
  const h2 = (h1 + 48 + ((hash >>> 7) % 55)) % 360;
  const h3 = (h2 + 62 + ((hash >>> 13) % 65)) % 360;
  return [h1, h2, h3];
}

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
  createdOnText: string;
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
  const [h1, h2, h3] = gradientHuesFromSeed(title);
  const bannerPlaceholderStyle = {
    backgroundImage: `radial-gradient(circle at 12% 18%, hsla(${h1}, 86%, 66%, 0.55), transparent 44%), radial-gradient(circle at 84% 84%, hsla(${h3}, 90%, 62%, 0.42), transparent 40%), linear-gradient(135deg, hsl(${h1}, 92%, 54%) 0%, hsl(${h2}, 86%, 52%) 48%, hsl(${h3}, 82%, 48%) 100%)`,
  } satisfies React.CSSProperties;
  const logoPlaceholderStyle = {
    backgroundImage: `linear-gradient(145deg, hsl(${h1}, 88%, 58%), hsl(${h2}, 78%, 49%))`,
  } satisfies React.CSSProperties;
  const logoInitial = title.trim().charAt(0).toUpperCase() || 'H';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl',
        'shadow-[0_24px_48px_-12px_rgba(5,33,22,0.55)]',
        /* Bottom breathing room lives on the footer strip so metadata + badges center between hairline and card edge */
        'px-8 pt-8 pb-0',
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
            className="pointer-events-none absolute inset-0"
            style={bannerPlaceholderStyle}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_8%,rgba(255,255,255,0.20),transparent_62%)]"
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-5">
        {/* Row 1: avatar + title/links — avatar size matches PR #2165 */}
        <div className="flex flex-wrap items-start gap-4 sm:gap-6">
          <Avatar className={COMPACT_SPACE_BANNER_AVATAR_CLASSNAME}>
            <AvatarImage
              src={safeLogoSrc}
              alt={logoAlt}
              className="object-cover"
            />
            <AvatarFallback
              className="text-xl font-semibold text-white"
              style={logoPlaceholderStyle}
            >
              {logoInitial}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 basis-[16rem] space-y-2">
            <h1
              className={cn(
                COMPACT_SPACE_BANNER_TITLE_CLASSNAME,
                'text-white drop-shadow-sm',
              )}
            >
              {title}
            </h1>
            {safeLinks.length > 0 ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
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
            <p className="text-pretty text-2 leading-[1.5] text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
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
            <div className="flex flex-col gap-3 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-5">
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-1 text-white/88 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
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
                    <span
                      className="hidden text-white/45 sm:inline"
                      aria-hidden
                    >
                      ·
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="font-bold tabular-nums text-white">
                        {agreementCount ?? '—'}
                      </span>{' '}
                      <span className="text-white/92">{agreementsLabel}</span>
                    </span>
                    <span
                      className="hidden text-white/45 sm:inline"
                      aria-hidden
                    >
                      ·
                    </span>
                    <span className="text-white/88">{createdOnText}</span>
                  </>
                ) : null}
              </div>

              {footerTrailing ? (
                <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto [&_a]:inline-flex [&_a]:items-center [&_div]:inline-flex [&_div]:items-center">
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
