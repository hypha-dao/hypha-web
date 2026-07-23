'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import {
  TransparencyLevel,
  TransparencyLevelComponent,
  type TransparencyOption,
} from '../../spaces/components/transparency-level';
import type {
  OnboardingTransparencyLevel,
  OnboardingTransparencyMatrix,
} from '../ai-onboarding-context';
import {
  defaultTransparencyForActivation,
  type OnboardingTransparencyPickerStep,
} from '../onboarding-transparency-ui';
import type { OnboardingActivationMethod } from '../ai-onboarding-context';

type OnboardingTransparencyMatrixCardProps = {
  disabled?: boolean;
  step: OnboardingTransparencyPickerStep;
  activationMethod?: OnboardingActivationMethod;
  selectedDiscoverability?: OnboardingTransparencyLevel;
  onConfirmDiscoverability?: (level: OnboardingTransparencyLevel) => void;
  onConfirm: (value: OnboardingTransparencyMatrix) => void;
};

export function OnboardingTransparencyMatrixCard({
  disabled = false,
  step,
  activationMethod,
  selectedDiscoverability,
  onConfirmDiscoverability,
  onConfirm,
}: OnboardingTransparencyMatrixCardProps) {
  const tAi = useTranslations('AiPanel');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const defaults = defaultTransparencyForActivation(activationMethod);
  const [matrix, setMatrix] = React.useState<OnboardingTransparencyMatrix>(
    () => ({
      discoverability: selectedDiscoverability ?? defaults.discoverability,
      access: defaults.access,
    }),
  );

  React.useEffect(() => {
    setMatrix((current) => ({
      discoverability: selectedDiscoverability ?? defaults.discoverability,
      access: current.access,
    }));
  }, [defaults.access, defaults.discoverability, selectedDiscoverability]);

  const discoverabilityOptions: TransparencyOption[] = [
    {
      id: TransparencyLevel.PUBLIC,
      title: tAgreementFlow('plugins.transparency.publicTitle'),
      description: tAgreementFlow('plugins.transparency.discoverabilityPublic'),
    },
    {
      id: TransparencyLevel.NETWORK,
      title: tAgreementFlow('plugins.transparency.networkTitle'),
      description: tAgreementFlow(
        'plugins.transparency.discoverabilityNetwork',
      ),
    },
    {
      id: TransparencyLevel.ORGANISATION,
      title: tAgreementFlow('plugins.transparency.organisationTitle'),
      description: tAgreementFlow(
        'plugins.transparency.discoverabilityOrganisation',
      ),
    },
    {
      id: TransparencyLevel.SPACE,
      title: tAgreementFlow('plugins.transparency.spaceTitle'),
      description: tAgreementFlow('plugins.transparency.discoverabilitySpace'),
    },
  ];

  const activityAccessOptions: TransparencyOption[] = [
    {
      id: TransparencyLevel.PUBLIC,
      title: tAgreementFlow('plugins.transparency.publicTitle'),
      description: tAgreementFlow('plugins.transparency.activityPublic'),
    },
    {
      id: TransparencyLevel.NETWORK,
      title: tAgreementFlow('plugins.transparency.networkTitle'),
      description: tAgreementFlow('plugins.transparency.activityNetwork'),
    },
    {
      id: TransparencyLevel.ORGANISATION,
      title: tAgreementFlow('plugins.transparency.organisationTitle'),
      description: tAgreementFlow('plugins.transparency.activityOrganisation'),
    },
    {
      id: TransparencyLevel.SPACE,
      title: tAgreementFlow('plugins.transparency.spaceTitle'),
      description: tAgreementFlow('plugins.transparency.activitySpace'),
    },
  ];

  const handlePrimaryAction = () => {
    if (step === 'discoverability') {
      onConfirmDiscoverability?.(matrix.discoverability);
      return;
    }
    onConfirm({
      discoverability: selectedDiscoverability ?? matrix.discoverability,
      access: matrix.access,
    });
  };

  return (
    <div className="rounded-lg border border-border/80 bg-background/90 p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium text-foreground">
        {step === 'discoverability'
          ? tAi('onboardingTransparencyDiscoverabilityTitle')
          : tAi('onboardingTransparencyActivityTitle')}
      </p>
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
        {step === 'discoverability'
          ? tAi('onboardingTransparencyDiscoverabilityHint')
          : tAi('onboardingTransparencyActivityHint')}
      </p>
      {step === 'discoverability' ? (
        <p className="mb-4 rounded-lg border border-accent-8/20 bg-accent-2/30 px-3 py-2 text-xs leading-relaxed text-foreground">
          {tAi('onboardingTransparencyBenefit')}
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        {step === 'discoverability' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              {tAgreementFlow(
                'plugins.spaceTransparencySettings.discoverability',
              )}
            </p>
            <TransparencyLevelComponent
              value={matrix.discoverability}
              options={discoverabilityOptions}
              onChange={(selected) =>
                setMatrix((current: OnboardingTransparencyMatrix) => ({
                  ...current,
                  discoverability: selected,
                }))
              }
            />
          </div>
        ) : (
          <>
            {selectedDiscoverability != null ? (
              <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {tAi('onboardingTransparencyDiscoverabilityChosen', {
                  level:
                    discoverabilityOptions.find(
                      (option) => option.id === selectedDiscoverability,
                    )?.title ?? '',
                })}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {tAgreementFlow(
                  'plugins.spaceTransparencySettings.activityAccess',
                )}
              </p>
              <TransparencyLevelComponent
                value={matrix.access}
                options={activityAccessOptions}
                onChange={(selected) =>
                  setMatrix((current: OnboardingTransparencyMatrix) => ({
                    ...current,
                    access: selected,
                  }))
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4">
        <Button type="button" onClick={handlePrimaryAction} disabled={disabled}>
          {step === 'discoverability'
            ? tAi('onboardingTransparencyDiscoverabilityConfirm')
            : tAi('onboardingTransparencyConfirm')}
        </Button>
      </div>
    </div>
  );
}
