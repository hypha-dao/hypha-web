'use client';

import { getLocaleMessagesSync } from '@hypha-platform/i18n/messages';

import type { OnboardingSetupJourneyMessageLabels } from './onboarding-setup-journey-ui';

type AiPanelRecord = Record<string, unknown>;
type SetupJourneyKind = 'single_space' | 'ecosystem';

const ONBOARDING_PICKER_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'mk'] as const;

const SETUP_JOURNEY_MESSAGE_KEYS: Record<SetupJourneyKind, readonly string[]> =
  {
    single_space: [
      'onboardingSetupJourneySetSingle',
      'onboardingSetupJourneySingleTitle',
    ],
    ecosystem: [
      'onboardingSetupJourneySetEcosystem',
      'onboardingSetupJourneyEcosystemTitle',
    ],
  };

/** Legacy submit strings before the Setup journey prefix was removed. */
const LEGACY_SETUP_JOURNEY_MESSAGES: Record<
  SetupJourneyKind,
  readonly string[]
> = {
  single_space: ['Setup journey: Single space'],
  ecosystem: ['Setup journey: Full ecosystem (multiple spaces)'],
};

function readAiPanel(locale: string): AiPanelRecord {
  return (getLocaleMessagesSync(locale).messages.AiPanel ??
    {}) as AiPanelRecord;
}

function readAiPanelString(locale: string, key: string): string | undefined {
  const value = readAiPanel(locale)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getOnboardingSetupJourneySubmitLabels(
  locale: string,
): OnboardingSetupJourneyMessageLabels {
  return {
    singleSpace:
      readAiPanelString(locale, 'onboardingSetupJourneySetSingle') ??
      readAiPanelString(locale, 'onboardingSetupJourneySingleTitle') ??
      readAiPanelString('en', 'onboardingSetupJourneySetSingle') ??
      'Single space',
    ecosystem:
      readAiPanelString(locale, 'onboardingSetupJourneySetEcosystem') ??
      readAiPanelString(locale, 'onboardingSetupJourneyEcosystemTitle') ??
      readAiPanelString('en', 'onboardingSetupJourneySetEcosystem') ??
      'Full ecosystem (multiple spaces)',
  };
}

function buildSetupJourneyVariantMap(): Map<string, SetupJourneyKind> {
  const variants = new Map<string, SetupJourneyKind>();

  const register = (text: string | undefined, kind: SetupJourneyKind) => {
    const normalized = text?.trim();
    if (!normalized) return;
    variants.set(normalized, kind);
  };

  for (const locale of ONBOARDING_PICKER_LOCALES) {
    for (const kind of ['single_space', 'ecosystem'] as const) {
      for (const key of SETUP_JOURNEY_MESSAGE_KEYS[kind]) {
        register(readAiPanelString(locale, key), kind);
      }
    }
  }

  for (const kind of ['single_space', 'ecosystem'] as const) {
    for (const legacy of LEGACY_SETUP_JOURNEY_MESSAGES[kind]) {
      register(legacy, kind);
    }
  }

  return variants;
}

const SETUP_JOURNEY_VARIANTS = buildSetupJourneyVariantMap();

export function localizeOnboardingSetupJourneyUserMessage(
  text: string,
  locale: string,
): string {
  const journey = SETUP_JOURNEY_VARIANTS.get(text.trim());
  if (!journey) return text;

  const labels = getOnboardingSetupJourneySubmitLabels(locale);
  return journey === 'ecosystem' ? labels.ecosystem : labels.singleSpace;
}

export function matchOnboardingSetupJourneyUserMessage(
  text: string,
): SetupJourneyKind | undefined {
  return SETUP_JOURNEY_VARIANTS.get(text.trim());
}

export function localizeOnboardingPickerUserMessage(
  text: string,
  locale: string,
): string {
  return localizeOnboardingSetupJourneyUserMessage(text, locale);
}
