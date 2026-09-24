'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

type SpaceSettingsButtonProps = {
  href: string;
  /**
   * `hero` stays light for a dark cover image.
   * `chrome` follows the surface: ink on paper, light on a dark ground.
   */
  variant?: 'hero' | 'chrome';
  className?: string;
};

/**
 * Gear icon linking to Space Settings (`select-settings-action`).
 * Icon only — square, no fill, no shadow.
 */
export function SpaceSettingsButton({
  href,
  variant = 'chrome',
  className,
}: SpaceSettingsButtonProps) {
  const t = useTranslations('ModalAside');

  return (
    <Link
      href={href}
      aria-label={t('spaceSettings')}
      title={t('spaceSettings')}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-opacity hover:opacity-80',
        variant === 'hero' ? 'text-white' : 'text-foreground',
        className,
      )}
    >
      <Settings className="size-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
