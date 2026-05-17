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
    <OnboardingAdventurePage
      aiChatEnabled={aiChatEnabled}
      onboardingHeroEnabled={onboardingHeroEnabled}
    />
  );
}
