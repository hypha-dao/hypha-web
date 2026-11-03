'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

/** Opens the same new-signal composer as the list Create quest control. */
export function SignalCreateQuestButton({
  lang,
  spaceSlug,
  className,
}: {
  lang: string;
  spaceSlug: string;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');

  return (
    <Button asChild colorVariant="accent" className={className}>
      <Link
        href={`/${lang}/dho/${spaceSlug}/coherence/new-signal`}
        data-testid="signal-create-quest"
      >
        <Sparkles className="craft-icon" aria-hidden />
        {t('createSignal')}
      </Link>
    </Button>
  );
}
