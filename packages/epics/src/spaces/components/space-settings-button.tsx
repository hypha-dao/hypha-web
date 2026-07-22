'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from './compact-space-banner';

type SpaceSettingsButtonProps = {
  href: string;
  /** Hero banner (dark image) vs modal chrome (neutral surface). */
  variant?: 'hero' | 'chrome';
  className?: string;
};

/**
 * Square gear control linking to Space Settings (`select-settings-action`).
 * Matches outlined header controls; hero variant is tuned for dark banner contrast.
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
        'inline-flex size-7 shrink-0 items-center justify-center border transition-colors',
        APP_CHROME_SUBTLE_SQUARE_RADIUS,
        variant === 'hero'
          ? 'border-white/40 bg-black/25 text-white shadow-sm backdrop-blur-sm hover:border-white/55 hover:bg-black/35'
          : 'border-border bg-background text-foreground hover:bg-accent/40',
        className,
      )}
    >
      <Settings className="size-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
