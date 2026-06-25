'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { EntryMethodType } from '@hypha-platform/core/client';

import { Button } from '@hypha-platform/ui';

import { EntryMethod } from '../../spaces/components/entry-method';
import type { OnboardingEntryMethod } from '../onboarding-entry-method-ui';

type OnboardingEntryMethodCardProps = {
  disabled?: boolean;
  onConfirm: (method: OnboardingEntryMethod) => void;
};

function toOnboardingEntryMethod(
  value: EntryMethodType,
): OnboardingEntryMethod {
  switch (value) {
    case EntryMethodType.OPEN_ACCESS:
      return 'open_access';
    case EntryMethodType.TOKEN_BASED:
      return 'token_based';
    case EntryMethodType.INVITE_ONLY:
    default:
      return 'invite_only';
  }
}

export function OnboardingEntryMethodCard({
  disabled = false,
  onConfirm,
}: OnboardingEntryMethodCardProps) {
  const tAi = useTranslations('AiPanel');
  const [selected, setSelected] = React.useState<EntryMethodType>(
    EntryMethodType.INVITE_ONLY,
  );

  return (
    <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {tAi('onboardingEntryMethodTitle')}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {tAi('onboardingEntryMethodHint')}
      </p>
      <EntryMethod value={selected} onChange={setSelected} />
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {tAi('onboardingEntryMethodTokenNote')}
      </p>
      <div className="mt-4">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => onConfirm(toOnboardingEntryMethod(selected))}
        >
          {tAi('onboardingEntryMethodConfirm')}
        </Button>
      </div>
    </div>
  );
}
