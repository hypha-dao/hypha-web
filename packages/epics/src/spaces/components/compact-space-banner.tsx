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
        'relative overflow-hidden rounded-2xl border border-white/10',
        'bg-gradient-to-br from-[#0b2214] via-[#143d28] to-[#0d2818]',
        'p-6 sm:p-8 shadow-lg',
        className,
      )}
      aria-label={title}
    >
      {/* Foliage-like noise + lead image texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 90% 40%, rgba(34, 197, 94, 0.35), transparent 55%),
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.2), transparent 45%),
            repeating-linear-gradient(
              -18deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.08) 2px,
              rgba(0, 0, 0, 0.08) 4px
            )
          `,
        }}
        aria-hidden
      />
      {textureSrc ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-right bg-no-repeat opacity-[0.18] mix-blend-overlay"
          style={{ backgroundImage: `url(${textureSrc})` }}
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-emerald-950/40"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <Avatar className="h-20 w-20 shrink-0 rounded-full ring-2 ring-white/25 ring-offset-2 ring-offset-[#0f331f]">
            <AvatarImage src={logoUrl || defaultLogoSrc} alt={logoAlt} />
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-7 font-semibold leading-tight tracking-tight text-white">
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
                    className="inline-flex items-center gap-1.5 text-1 text-white/95 hover:text-white"
                  >
                    <span className="text-white/90 [&_svg]:h-4 [&_svg]:w-4">
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

            {description ? (
              <p className="max-w-full text-2 leading-relaxed text-white/90 sm:max-w-[52%]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="h-px w-full bg-white/15" role="presentation" />

        <div className="flex flex-col gap-4 gap-x-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-1 text-white/75">
            <span>
              <span className="font-semibold text-white/95">{memberCount}</span>{' '}
              {membersLabel}
            </span>
            <span className="text-white/40" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-semibold text-white/95">
                {agreementCount}
              </span>{' '}
              {agreementsLabel}
            </span>
            <span className="text-white/40" aria-hidden>
              ·
            </span>
            <span>{createdOnText}</span>
          </div>

          {footerTrailing ? (
            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              {footerTrailing}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
