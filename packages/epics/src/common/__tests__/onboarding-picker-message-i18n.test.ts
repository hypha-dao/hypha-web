import { describe, expect, it } from 'vitest';

import {
  getOnboardingSetupJourneySubmitLabels,
  localizeOnboardingSetupJourneyUserMessage,
} from '../onboarding-picker-message-i18n';

describe('onboarding-picker-message-i18n', () => {
  it('returns locale-specific setup journey submit labels', () => {
    expect(getOnboardingSetupJourneySubmitLabels('pt').singleSpace).toBe(
      'Espaço único',
    );
    expect(getOnboardingSetupJourneySubmitLabels('fr').ecosystem).toBe(
      'Écosystème complet (plusieurs espaces)',
    );
  });

  it('localizes stored English picker text for the active locale', () => {
    expect(
      localizeOnboardingSetupJourneyUserMessage('Single space', 'pt'),
    ).toBe('Espaço único');
    expect(
      localizeOnboardingSetupJourneyUserMessage(
        'Setup journey: Full ecosystem (multiple spaces)',
        'de',
      ),
    ).toBe('Volles Ökosystem (mehrere Spaces)');
  });

  it('leaves unrelated user text unchanged', () => {
    expect(
      localizeOnboardingSetupJourneyUserMessage(
        'We are building a climate cooperative',
        'pt',
      ),
    ).toBe('We are building a climate cooperative');
  });
});
