import * as React from 'react';
import { LinkIcon } from '../../common/link-icon';
import { LinkLabel } from '../../common/link-label';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export type CompactSpaceBannerProps = {
  title: string;
  description: string | null | undefined;
  logoUrl: string | null | undefined;
  logoAlt: string;
  defaultLogoSrc: string;
  links?: string[] | null;
  /** Shown faintly on the right; reinforces the space visual identity */
  leadImageUrl?: string | null;
  defaultLeadImageSrc?: string;
  memberCount: number;
  agreementCount: number;
  /** Pre-formatted created date string (locale-aware) */
  createdOnText: string;
  membersLabel: string;
  agreementsLabel: string;
  /** Trial / sandbox badges — typically `SubscriptionBadge` + `SpaceModeLabel` */
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
  const textureSrc = leadImageUrl || defaultLeadImageSrc || undefined;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/25',
        'shadow-[0_24px_48px_-12px_rgba(5,33,22,0.55)]',
        'p-8',
        className,
      )}
      aria-label={title}
    >
      {/* Base gradient — lighter top-left (Image 2), darker bottom-right */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_10%_-10%,rgb(34,94,62)_0%,rgb(14,54,38)_42%,rgb(5,33,22)_72%,rgb(2,18,12)_100%)]"
        aria-hidden
      />

      {/* Fine grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      {/* Bokeh foliage — full-bleed, visibly layered like Image 2 */}
      {textureSrc ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.42]"
            style={{
              backgroundImage: `url(${textureSrc})`,
              filter: 'blur(28px) saturate(1.15)',
              transform: 'scale(1.08)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-[center_30%] bg-no-repeat opacity-[0.35] mix-blend-soft-light"
            style={{ backgroundImage: `url(${textureSrc})` }}
            aria-hidden
          />
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 70% 55% at 85% 35%, rgba(34, 197, 94, 0.35), transparent 60%),
              radial-gradient(circle at 25% 75%, rgba(16, 185, 129, 0.22), transparent 50%)
            `,
          }}
          aria-hidden
        />
      )}

      {/* Readability veil — keeps text crisp over photo */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/35 via-transparent to-emerald-950/55"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-6">
        {/* Header row: avatar + title stack only (Image 2) */}
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20 shrink-0 rounded-full ring-2 ring-emerald-400/90 ring-offset-[3px] ring-offset-[#0a2818]">
            <AvatarImage src={logoUrl || defaultLogoSrc} alt={logoAlt} />
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-7 font-bold leading-tight tracking-tight text-white">
              {title}
            </h1>
            {links && links.length > 0 ? (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {links.map((link, index) => (
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

        {/* Body — full width under header (Image 2); not constrained to half column */}
        {description ? (
          <p className="max-w-none text-2 leading-[1.5] text-white">
            {description}
          </p>
        ) : null}

        <div className="h-px w-full bg-white/12" role="presentation" />

        <div className="flex flex-col gap-4 gap-x-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-1 text-neutral-11">
            <span>
              <span className="font-bold text-white">{memberCount}</span>{' '}
              {membersLabel}
            </span>
            <span className="text-neutral-10" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-bold text-white">{agreementCount}</span>{' '}
              {agreementsLabel}
            </span>
            <span className="text-neutral-10" aria-hidden>
              ·
            </span>
            <span>{createdOnText}</span>
          </div>

          {footerTrailing ? (
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end [&_.rounded-lg]:rounded-full [&_button]:rounded-full">
              {footerTrailing}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
