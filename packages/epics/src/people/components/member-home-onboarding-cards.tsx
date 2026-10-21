'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  OnboardingActivationModeCard,
  OnboardingEntryMethodCard,
  OnboardingSpaceLocationCard,
  OnboardingTransparencyMatrixCard,
} from '../../common/ai-panel';
import type { OnboardingActivationMethod } from '../../common/onboarding-activation-ui';
import {
  formatOnboardingActivationSubmitMessage,
  shouldShowOnboardingActivationPicker,
} from '../../common/onboarding-activation-ui';
import {
  formatOnboardingEntryMethodSubmitMessage,
  shouldShowOnboardingEntryMethodPicker,
} from '../../common/onboarding-entry-method-ui';
import { findLatestOnboardingGuidanceOutput } from '../../common/onboarding-guidance-picker-ui';
import {
  formatOnboardingLocationSubmitMessage,
  shouldShowOnboardingLocationPicker,
} from '../../common/onboarding-location-ui';
import {
  formatOnboardingDiscoverabilitySubmitMessage,
  formatOnboardingTransparencySubmitMessage,
  resolveOnboardingTransparencyPickerStep,
  shouldShowOnboardingTransparencyPicker,
} from '../../common/onboarding-transparency-ui';
import type { OnboardingTransparencyLevel } from '../../common/ai-onboarding-context';

type HomeOnboardingMessage = {
  role: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
};

function messageText(message: HomeOnboardingMessage) {
  return (message.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text ?? '' : ''))
    .join('')
    .trim();
}

function activationMethodOf(
  value: string | null | undefined,
): OnboardingActivationMethod | undefined {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) return undefined;
  if (normalized.includes('sandbox')) return 'sandbox';
  if (normalized.includes('pilot')) return 'pilot';
  if (normalized.includes('live') || normalized.includes('deployment')) {
    return 'deployment';
  }
  return undefined;
}

function transparencyLevelOf(
  value: unknown,
): OnboardingTransparencyLevel | undefined {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3
  ) {
    return value as OnboardingTransparencyLevel;
  }
  return undefined;
}

/** A one-word reply such as "Space" or "Sandbox", before the tool records it. */
function levelFromShortReply(
  text: string,
): OnboardingTransparencyLevel | undefined {
  switch (text.trim().toLowerCase()) {
    case 'public':
      return 0;
    case 'network':
      return 1;
    case 'organisation':
    case 'organization':
      return 2;
    case 'space':
      return 3;
    default:
      return undefined;
  }
}

function latestShortLevel(messages: HomeOnboardingMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;
    const level = levelFromShortReply(messageText(message));
    if (level != null) return level;
  }
  return undefined;
}

function latestShortActivation(messages: HomeOnboardingMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;
    const method = activationMethodOf(messageText(message));
    if (method) return method;
  }
  return undefined;
}

export function MemberHomeOnboardingCards({
  messages,
  isStreaming,
  onSend,
}: {
  messages: HomeOnboardingMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
}) {
  const t = useTranslations('AiPanel');
  const [chosenDiscoverability, setChosenDiscoverability] = useState<
    OnboardingTransparencyLevel | undefined
  >(undefined);
  const guidance = findLatestOnboardingGuidanceOutput(messages);
  const showActivation = shouldShowOnboardingActivationPicker({
    messages,
    isStreaming,
  });
  const showTransparency = shouldShowOnboardingTransparencyPicker({
    messages,
    isStreaming,
  });
  const transparencyStep = showTransparency
    ? resolveOnboardingTransparencyPickerStep(messages)
    : null;
  const showEntry = shouldShowOnboardingEntryMethodPicker({
    messages,
    isStreaming,
  });
  const showLocation = shouldShowOnboardingLocationPicker({
    messages,
    isStreaming,
  });

  if (!showActivation && !transparencyStep && !showEntry && !showLocation) {
    return null;
  }

  const activationMethod =
    activationMethodOf(guidance?.answered_activation_method) ??
    latestShortActivation(messages);
  const selectedDiscoverability =
    chosenDiscoverability ??
    transparencyLevelOf(guidance?.answered_transparency_discoverability) ??
    latestShortLevel(messages);

  const transparencyLabels = {
    levelPublic: t('onboardingTransparencyLevelPublic'),
    levelNetwork: t('onboardingTransparencyLevelNetwork'),
    levelOrganisation: t('onboardingTransparencyLevelOrganisation'),
    levelSpace: t('onboardingTransparencyLevelSpace'),
    summary: (discoverability: string, access: string) =>
      t('onboardingTransparencySetSummary', { discoverability, access }),
    discoverabilitySummary: (discoverability: string) =>
      t('onboardingTransparencyDiscoverabilitySetSummary', {
        discoverability,
      }),
  };

  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-4">
        {showActivation ? (
          <OnboardingActivationModeCard
            disabled={isStreaming}
            onSelect={(method) => {
              onSend(
                formatOnboardingActivationSubmitMessage(method, {
                  sandbox: t('onboardingActivationSetSandbox'),
                  pilot: t('onboardingActivationSetPilot'),
                  deployment: t('onboardingActivationSetDeployment'),
                }),
              );
            }}
          />
        ) : null}
        {transparencyStep ? (
          <OnboardingTransparencyMatrixCard
            disabled={isStreaming}
            step={transparencyStep}
            activationMethod={activationMethod}
            selectedDiscoverability={selectedDiscoverability}
            onConfirmDiscoverability={(level) => {
              setChosenDiscoverability(level);
              onSend(
                formatOnboardingDiscoverabilitySubmitMessage(
                  level,
                  transparencyLabels,
                ),
              );
            }}
            onConfirm={(matrix) => {
              onSend(
                formatOnboardingTransparencySubmitMessage(
                  matrix,
                  transparencyLabels,
                ),
              );
            }}
          />
        ) : null}
        {showEntry ? (
          <OnboardingEntryMethodCard
            disabled={isStreaming}
            onConfirm={(method) => {
              onSend(
                formatOnboardingEntryMethodSubmitMessage(method, {
                  openAccess: t('onboardingEntryMethodSetOpen'),
                  inviteOnly: t('onboardingEntryMethodSetInvite'),
                  tokenBased: t('onboardingEntryMethodSetToken'),
                }),
              );
            }}
          />
        ) : null}
        {showLocation ? (
          <OnboardingSpaceLocationCard
            disabled={isStreaming}
            onConfirm={(value) => {
              onSend(
                formatOnboardingLocationSubmitMessage(value, {
                  withLabel: (label) =>
                    t('onboardingLocationSetWithLabel', { label }),
                  withCoordinates: (latitude, longitude) =>
                    t('onboardingLocationSetWithCoordinates', {
                      latitude,
                      longitude,
                    }),
                  fallback: t('onboardingLocationSetFallback'),
                }),
              );
            }}
            onSkip={() => {
              onSend(t('onboardingLocationSkipMessage'));
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
