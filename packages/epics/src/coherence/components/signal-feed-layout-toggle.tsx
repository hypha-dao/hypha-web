'use client';

import { LayoutGrid, List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalFeedLayout } from '../lib/signal-feed-layout';

const OPTIONS: Array<{
  value: SignalFeedLayout;
  labelKey: 'signalLayoutList' | 'signalLayoutCards';
  icon: typeof List;
  testId: string;
}> = [
  {
    value: 'list',
    labelKey: 'signalLayoutList',
    icon: List,
    testId: 'signal-layout-list',
  },
  {
    value: 'cards',
    labelKey: 'signalLayoutCards',
    icon: LayoutGrid,
    testId: 'signal-layout-cards',
  },
];

export function SignalFeedLayoutToggle({
  layout,
  onChange,
}: {
  layout: SignalFeedLayout;
  onChange: (layout: SignalFeedLayout) => void;
}) {
  const t = useTranslations('CoherenceTab');

  return (
    <div
      role="group"
      aria-label={t('signalLayout')}
      className="inline-flex shrink-0 items-center gap-1"
    >
      {OPTIONS.map((option) => {
        const active = layout === option.value;
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={active ? 'default' : 'outline'}
            colorVariant={active ? 'accent' : 'neutral'}
            size="sm"
            aria-pressed={active}
            data-testid={option.testId}
            className={cn('gap-1.5')}
            onClick={() => onChange(option.value)}
          >
            <Icon className="size-3.5" aria-hidden />
            {t(option.labelKey)}
          </Button>
        );
      })}
    </div>
  );
}
