import { Suspense } from 'react';
import { OnboardingAdventurePage } from './_components/onboarding-adventure-page';
import {
  getEnableAiChat,
  getEnableOnboardingAiHero,
} from '@hypha-platform/feature-flags';

export default async function OnboardingPage() {
  const [aiChatEnabled, onboardingHeroEnabled] = await Promise.all([
    getEnableAiChat(),
    getEnableOnboardingAiHero(),
  ]);
  return (
    <Suspense fallback={null}>
      <OnboardingAdventurePage
        aiChatEnabled={aiChatEnabled}
        onboardingHeroEnabled={onboardingHeroEnabled}
      />
    </Suspense>
  );
}
