import {
  AiLeftPanelShell,
  SpaceNavIntentProvider,
} from '@hypha-platform/epics';
import { getEnableCoherence } from '@hypha-platform/feature-flags';

/**
 * Server wrapper: passes coherence flag into the left panel shell (space nav + AI).
 */
export default async function ConnectedAiLeftPanelShell() {
  const coherenceEnabled = await getEnableCoherence();
  return (
    <SpaceNavIntentProvider>
      <AiLeftPanelShell coherenceEnabled={coherenceEnabled} />
    </SpaceNavIntentProvider>
  );
}
