'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Badge } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useSpaceMember } from '../hooks';
import { useRouter } from 'next/navigation';
import { cn } from '@hypha-platform/ui-utils';

interface SpaceModeLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  isArchived: boolean;
  configPath?: string;
  web3SpaceId?: number;
  className?: string;
  /** Applied to inner Badge (e.g. dark hero contrast) */
  badgeClassName?: string;
  /** High-contrast outline + dark hover (e.g. space hero on dark scrim) */
  forDarkBackground?: boolean;
}

const spaceModeDarkHero: Record<'accent' | 'error', string> = {
  accent:
    'border-blue-400/55 bg-black/35 text-blue-50 shadow-none hover:border-blue-300/75 hover:bg-blue-950/45 focus-visible:ring-blue-400/35',
  error:
    'border-red-400/55 bg-black/35 text-red-50 shadow-none hover:border-red-300/75 hover:bg-red-950/45 focus-visible:ring-red-400/35',
};

const LabelButton = ({
  caption,
  configPath,
  colorVariant = 'accent',
  badgeClassName,
  forDarkBackground,
}: {
  caption: string;
  configPath: string;
  colorVariant?: 'accent' | 'error';
  badgeClassName?: string;
  forDarkBackground?: boolean;
}) => {
  const t = useTranslations('Spaces');
  const router = useRouter();
  return (
    <Badge
      className={cn(
        'flex cursor-pointer',
        forDarkBackground && spaceModeDarkHero[colorVariant],
        badgeClassName,
      )}
      colorVariant={colorVariant}
      variant="outline"
      role="link"
      title={t('changeSpaceConfiguration')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(configPath);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          router.push(configPath);
        }
      }}
      onMouseEnter={() => router.prefetch?.(configPath)}
    >
      {caption}
    </Badge>
  );
};
const LabelBadge = ({
  caption,
  colorVariant = 'accent',
  badgeClassName,
  forDarkBackground,
}: {
  caption: string;
  colorVariant?: 'accent' | 'error';
  badgeClassName?: string;
  forDarkBackground?: boolean;
}) => (
  <Badge
    className={cn(
      'flex',
      forDarkBackground && spaceModeDarkHero[colorVariant],
      badgeClassName,
    )}
    colorVariant={colorVariant}
    variant="outline"
  >
    {caption}
  </Badge>
);

const MemberLabel = ({
  caption,
  web3SpaceId,
  configPath,
  colorVariant = 'accent',
  badgeClassName,
  forDarkBackground,
}: {
  caption: string;
  web3SpaceId: number;
  configPath: string;
  colorVariant?: 'accent' | 'error';
  badgeClassName?: string;
  forDarkBackground?: boolean;
}) => {
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  return isMember ? (
    <LabelButton
      caption={caption}
      configPath={configPath}
      colorVariant={colorVariant}
      badgeClassName={badgeClassName}
      forDarkBackground={forDarkBackground}
    />
  ) : (
    <LabelBadge
      caption={caption}
      colorVariant={colorVariant}
      badgeClassName={badgeClassName}
      forDarkBackground={forDarkBackground}
    />
  );
};

export const SpaceModeLabel = ({
  isSandbox,
  isDemo,
  isArchived,
  configPath,
  web3SpaceId,
  className,
  badgeClassName,
  forDarkBackground,
}: SpaceModeLabelProps) => {
  const t = useTranslations('Spaces');
  const { isAuthenticated } = useAuthentication();
  const isLive = !isSandbox && !isDemo && !isArchived;
  if (isLive) {
    return null;
  }
  const caption = isSandbox
    ? t('sandbox')
    : isDemo
    ? t('pilot')
    : isArchived
    ? t('archived')
    : '';
  const colorVariant = isArchived ? 'error' : 'accent';
  return (
    <div className={cn('flex', className)}>
      {isAuthenticated && !!configPath && Number.isFinite(web3SpaceId) ? (
        <MemberLabel
          caption={caption}
          web3SpaceId={web3SpaceId as number}
          configPath={configPath}
          colorVariant={colorVariant}
          badgeClassName={badgeClassName}
          forDarkBackground={forDarkBackground}
        />
      ) : (
        <LabelBadge
          caption={caption}
          colorVariant={colorVariant}
          badgeClassName={badgeClassName}
          forDarkBackground={forDarkBackground}
        />
      )}
    </div>
  );
};
