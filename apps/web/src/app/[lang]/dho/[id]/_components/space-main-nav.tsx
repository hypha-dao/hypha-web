import { Locale } from '@hypha-platform/i18n';
import {
  getEnableCoherence,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';
import { NavigationTabs } from './navigation-tabs';

/** Server wrapper so flag reads stay off the client bundle of NavigationTabs. */
export async function SpaceMainNav({ lang, id }: { lang: Locale; id: string }) {
  const [coherenceEnabled, memoryEnabled] = await Promise.all([
    getEnableCoherence(),
    getEnableSpaceMemory(),
  ]);

  return (
    <NavigationTabs
      lang={lang}
      id={id}
      coherenceEnabled={coherenceEnabled}
      memoryEnabled={memoryEnabled}
    />
  );
}
