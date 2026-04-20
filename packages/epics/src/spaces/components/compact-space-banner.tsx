import * as React from 'react';
import { LinkIcon } from '../../common/link-icon';
import { LinkLabel } from '../../common/link-label';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { CompactSpaceBannerLead } from './compact-space-banner-lead';

function isSafeLinkHref(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeTextureUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  /** Same-origin path only — reject protocol-relative `//evil` */
  if (t.startsWith('/') && !t.startsWith('//')) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Matches PR #2165 `SpaceHeaderInsetAvatar` footprint */
const AVATAR_CLASS = cn(
  'h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]',
  'shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15',
);

/** Purpose column — narrow on sm+; left edge aligns with avatar (full-width column below header row). */
const DESCRIPTION_SCROLL_BOX = cn(
  'max-h-[min(45vh,280px)] w-full max-w-full min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y sm:max-w-[50%]',
  '[scrollbar-gutter:stable]',
  '[scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent',
);

export type CompactSpaceBannerProps = {
  title: string;
  description: string | null | undefined;
  logoUrl: string | null | undefined;
  logoAlt: string;
  defaultLogoSrc: string;
  links?: string[] | null;
  leadImageUrl?: string | null;
  defaultLeadImageSrc?: string;
  memberCount: number;
  agreementCount: number;
  createdOnText: string;
  membersLabel: string;
  agreementsLabel: string;
  footerTrailing?: React.ReactNode;
  className?: string;
};

export function CompactSpaceBanner({
  title,
  description,
  logoUrl,
  logoAlt,
  defaultLogoSrc,
  links,
  leadImageUrl,
  defaultLeadImageSrc,
  memberCount,
  agreementCount,
  createdOnText,
  membersLabel,
  agreementsLabel,
  footerTrailing,
  className,
}: CompactSpaceBannerProps) {
  const textureSrc = (() => {
    const lead = leadImageUrl?.trim();
    const fallback = defaultLeadImageSrc?.trim() ?? '';
    if (lead && isSafeTextureUrl(lead)) return lead;
    if (fallback && isSafeTextureUrl(fallback)) return fallback;
    return '';
  })();

  const safeLinks =
    links?.filter((l) => typeof l === 'string' && isSafeLinkHref(l)) ?? [];

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border border-[#30363d]',
        'shadow-[0_24px_48px_-12px_rgba(5,33,22,0.55)]',
        'px-8 pt-8 pb-5',
        className,
      )}
      aria-label={title}
    >
      {/* Lead image — Image + preload avoids grey decode flash; overlays unchanged */}
      {textureSrc ? (
        <>
          <CompactSpaceBannerLead src={textureSrc} />
          {/* PR #2165 stack + depth pass — alphas modulated via inherited CSS vars from SpaceAccentFromImages */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to top, rgba(0,0,0,var(--banner-ov-v-bottom, 0.88)) 0%, rgba(0,0,0,var(--banner-ov-v-mid, 0.42)) var(--banner-ov-v-mid-at, 52%), rgba(0,0,0,var(--banner-ov-v-top, 0.22)) 100%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,var(--banner-ov-h-from, 0.58)), transparent, rgba(0,0,0,var(--banner-ov-h-to, 0.4)))',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) calc(var(--banner-ov-accent-wash, 0.18) * 100%), transparent), transparent, transparent)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 55% 45% at 82% 8%, rgba(209,250,229,calc(0.38 * var(--banner-ov-skylight-op, 0.9))), transparent 62%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, rgba(255,255,255,var(--banner-ov-sheen-op, 0.07)) -10%, transparent 40%, transparent 55%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 115% 95% at 50% 72%, transparent 22%, rgba(0,18,12,calc(0.62 * var(--banner-ov-vignette-strength, 1))) 88%, rgba(0,8,5,calc(0.92 * var(--banner-ov-vignette-strength, 1))) 100%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
            style={{
              opacity: 'var(--banner-ov-grain-op, 0.055)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,var(--banner-ov-inner-top, 0.09)), inset 0 -1px 0 rgba(0,0,0,var(--banner-ov-inner-bot, 0.18))',
            }}
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_140%_100%_at_12%_-5%,rgb(41,115,78)_0%,rgb(14,54,38)_42%,rgb(7,38,26)_68%,rgb(2,14,10)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-80 bg-[radial-gradient(ellipse_50%_40%_at_80%_5%,rgba(52,211,153,0.2),transparent_60%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_90%_at_50%_78%,transparent_35%,rgba(0,14,10,0.72)_92%)]"
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-5">
        {/* Row 1: avatar + title/links — avatar size matches PR #2165 */}
        <div className="flex items-start gap-6">
          <Avatar className={AVATAR_CLASS}>
            <AvatarImage
              src={logoUrl || defaultLogoSrc}
              alt={logoAlt}
              className="object-cover"
            />
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-balance text-6 font-semibold tracking-tight text-white drop-shadow-sm sm:text-7">
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
          <div className={DESCRIPTION_SCROLL_BOX}>
            <p className="text-pretty text-2 leading-[1.5] text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
              {description}
            </p>
          </div>
        ) : null}

        {/* Hairline + metadata: one flex item so gap-5 does not double-space above the strip */}
        <div className="flex flex-col">
          <div
            className="h-px w-full shrink-0 bg-white/12"
            role="presentation"
          />
          <div className="flex flex-col gap-3 gap-x-5 pt-3.5 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-1 text-white/88 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
              <span>
                <span className="font-bold tabular-nums text-white">
                  {memberCount}
                </span>{' '}
                <span className="text-white/92">{membersLabel}</span>
              </span>
              <span className="text-white/45" aria-hidden>
                ·
              </span>
              <span>
                <span className="font-bold tabular-nums text-white">
                  {agreementCount}
                </span>{' '}
                <span className="text-white/92">{agreementsLabel}</span>
              </span>
              <span className="text-white/45" aria-hidden>
                ·
              </span>
              <span className="text-white/88">{createdOnText}</span>
            </div>

            {footerTrailing ? (
              <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end [&_.rounded-lg]:rounded-md [&_a]:inline-flex [&_a]:items-center [&_button]:rounded-md [&_div]:inline-flex [&_div]:items-center">
                {footerTrailing}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
