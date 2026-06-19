'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import {
  SpaceLocationPicker,
  type SpaceLocationValue,
} from '../../spaces/components/space-location-picker';

type OnboardingSpaceLocationCardProps = {
  disabled?: boolean;
  onConfirm: (value: SpaceLocationValue) => void;
  onSkip: () => void;
};

export function OnboardingSpaceLocationCard({
  disabled = false,
  onConfirm,
  onSkip,
}: OnboardingSpaceLocationCardProps) {
  const t = useTranslations('AiPanel');
  const [value, setValue] = useState<SpaceLocationValue>({
    latitude: null,
    longitude: null,
    locationLabel: null,
    locationSource: null,
  });

  const canConfirm = value.latitude != null && value.longitude != null;

  return (
    <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {t('onboardingLocationTitle')}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {t('onboardingLocationHint')}
      </p>
      <SpaceLocationPicker
        value={value}
        onChange={setValue}
        disabled={disabled}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => onConfirm(value)}
          disabled={!canConfirm || disabled}
        >
          {t('onboardingLocationConfirm')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={disabled}
        >
          {t('onboardingLocationSkip')}
        </Button>
      </div>
    </div>
  );
}
