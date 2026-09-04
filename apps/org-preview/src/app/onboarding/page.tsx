import { ENTRIES } from '@/lib/entries';
import { App } from '../app';

/** `/onboarding` — River Commons' door: first login, no profile yet. */
export default function OnboardingPage() {
  return <App entry={ENTRIES.onboarding} />;
}
