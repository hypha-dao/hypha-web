import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { LinkIcon } from '../../common/link-icon';
import { LinkLabel } from '../../common/link-label';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { isSafeExternalUrl, isSafeImageUrl } from '../utils/safe-image-url';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from '../../common/chrome-radius';

export { APP_CHROME_SUBTLE_SQUARE_RADIUS };

/** Square space mark on the identity row — shared footprint, not a circular hero avatar */
export const COMPACT_SPACE_BANNER_AVATAR_CLASSNAME = cn(
  'h-9 w-9 shrink-0 rounded-none border border-border/70 md:h-11 md:w-11',
);

/** Title size on the identity row — Sora, tool-sized, one line */
export const COMPACT_SPACE_BANNER_TITLE_CLASSNAME = cn(
  'truncate text-4 font-medium tracking-[-0.02em] md:text-5',
  '[font-family:var(--font-family-heading)]',
);

/** Smaller footprint for the DHO sticky space chrome row */
export const STICKY_SPACE_CHROME_AVATAR_CLASSNAME = cn(
  'h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11',
  'ring-1 ring-border/60',
);

export const STICKY_SPACE_CHROME_TITLE_CLASSNAME = cn(
  'text-balance text-4 font-medium tracking-[-0.03em] sm:text-5',
  '[font-family:var(--font-family-heading)]',
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
  /** Localized label for revealing secondary meta (links / stats). */
  revealMetaLabel?: string;
  /** Header actions that stay on the identity row (settings). */
  footerTrailing?: React.ReactNode;
  /** Secondary actions revealed with Details (subscription / “Active until”). */
  detailsTrailing?: React.ReactNode;
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
  /** Renders inside Details (e.g. member since, email) */
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

function WholeCoverImage({ src }: { src: string }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return null;

  return (
    <img
      src={src}
      alt=""
      className="mx-auto block h-auto max-w-full"
      onError={() => setFailed(true)}
    />
  );
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
    revealMetaLabel = 'Details',
    footerTrailing,
    detailsTrailing,
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
  const [metaExpanded, setMetaExpanded] = React.useState(false);
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

  const hasSecondaryMeta =
    safeLinks.length > 0 ||
    Boolean(footerLeading) ||
    Boolean(detailsTrailing) ||
    showSpaceStats;
  const hasDisclosure = hasSecondaryMeta || Boolean(textureSrc);

  const secondaryMeta = (
    <>
      {safeLinks.length > 0 ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {safeLinks.map((link, index) => (
            <a
              key={`${link}_${index}`}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-1 text-muted-foreground hover:text-foreground"
            >
              <span className="text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
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

      {footerLeading || showSpaceStats || detailsTrailing ? (
        <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-1 text-1 text-muted-foreground">
          {footerLeading ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {footerLeading}
            </div>
          ) : null}
          {footerLeading && showSpaceStats ? (
            <span
              className="hidden text-muted-foreground/60 sm:inline"
              aria-hidden
            >
              ·
            </span>
          ) : null}
          {showSpaceStats ? (
            <>
              <span className="inline-flex items-baseline gap-1">
                <span className="tabular-nums text-foreground">
                  {memberCount ?? '—'}
                </span>{' '}
                <span>{membersLabel}</span>
              </span>
              <span className="text-muted-foreground/50" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-baseline gap-1">
                <span className="tabular-nums text-foreground">
                  {agreementCount ?? '—'}
                </span>{' '}
                <span>{agreementsLabel}</span>
              </span>
              <span className="text-muted-foreground/50" aria-hidden>
                ·
              </span>
              <span>{createdOnText}</span>
            </>
          ) : null}
          {detailsTrailing ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {detailsTrailing}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <section
      className={cn(
        'relative rounded-none border border-border/70 bg-background shadow-none',
        className,
      )}
      aria-label={title}
    >
      <div className="relative flex h-16 items-center gap-3 px-4 md:h-[4.75rem] md:gap-4 md:px-6">
        <div
          className="space-accent-banner-wash pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--space-accent, transparent) 70%, transparent)',
          }}
          aria-hidden
        />

        <Avatar
          className={cn('relative z-10', COMPACT_SPACE_BANNER_AVATAR_CLASSNAME)}
        >
          <AvatarImage src={safeLogoSrc} alt={logoAlt} />
        </Avatar>

        <div
          className="relative z-10 min-w-0 flex-1"
          role={description ? 'group' : undefined}
          aria-label={description ? descriptionLabel : undefined}
        >
          <h1
            className={cn(
              COMPACT_SPACE_BANNER_TITLE_CLASSNAME,
              'text-foreground',
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className="truncate text-2 font-normal leading-5 text-foreground/75 [font-family:var(--font-family-text)]"
              title={description}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-3">
          {hasDisclosure ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-1 font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={metaExpanded}
              onClick={() => setMetaExpanded((v) => !v)}
            >
              {revealMetaLabel}
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-150',
                  metaExpanded && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          ) : null}
          {footerTrailing ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 [&_a]:inline-flex [&_a]:items-center [&_div]:inline-flex [&_div]:items-center">
              {footerTrailing}
            </div>
          ) : null}
        </div>
      </div>

      {hasDisclosure && metaExpanded ? (
        <div className="bg-background">
          {textureSrc ? (
            <div className="bg-background px-4 pt-4 md:px-6">
              <WholeCoverImage src={textureSrc} />
            </div>
          ) : null}
          {hasSecondaryMeta ? (
            <div className="flex flex-col gap-2 px-4 py-3 md:px-6 md:py-4">
              {secondaryMeta}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
