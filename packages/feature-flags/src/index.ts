import {
  getVercelToolbarFlagOverrides,
  readBooleanOverride,
} from './vercel-toolbar-overrides';

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
};

/**
 * Default feature exposure:
 * - Language select: on
 * - AI panel: on
 * - Coherence/signals: on
 * - Space memory: on
 * - Human chat: on
 *
 * Toolbar overrides and `NEXT_PUBLIC_*` env values still take precedence.
 */

/**
 * Static metadata for Vercel Flags discovery (`/.well-known/vercel/flags`).
 * Runtime reads use the `get*` functions below.
 *
 * **Vercel Toolbar:** When `FLAGS_SECRET` is set, `get*` reads the
 * `vercel-flag-overrides` cookie (same as `flags/next`) so toolbar toggles apply.
 * `NEXT_PUBLIC_*` env vars and fallback defaults apply when there is no override for that key.
 * Without `FLAGS_SECRET`, SSR still works; toolbar overrides are ignored until the
 * secret is configured on the project.
 */
export const flagDefinitionsForDiscovery = {
  showLanguageSelect: {
    key: 'show-language-select',
    defaultValue:
      parseBoolean(process.env.NEXT_PUBLIC_ENABLE_SHOW_LANGUAGE_SELECT) ?? true,
    description: 'Show the i18n language select button in the menu bar',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableAiChat: {
    key: 'enable-ai-chat',
    defaultValue: true,
    description: 'Enable the AI Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableCoherence: {
    key: 'enable-coherence',
    defaultValue: true,
    description:
      'Coherence tab and signals. Opt in: HYPHA_ENABLE_COHERENCE cookie or NEXT_PUBLIC_ENABLE_COHERENCE=true. Space Memory uses enable-space-memory.',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableSpaceMemory: {
    key: 'enable-space-memory',
    defaultValue:
      // Intentional mature-feature default: space memory has production ops checks and
      // can be rolled back immediately via NEXT_PUBLIC_ENABLE_SPACE_MEMORY=false.
      parseBoolean(process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY) ?? true,
    description:
      'Space Memory on Coherence tab. Opt in: HYPHA_ENABLE_SPACE_MEMORY cookie or NEXT_PUBLIC_ENABLE_SPACE_MEMORY=true',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  /**
   * Toolbar key matches `readBooleanOverride(..., 'enable-human-chat')`.
   * Discovery `defaultValue` matches {@link getEnableHumanChat} when unset
   * (default on, disabled only by explicit kill switches).
   */
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: true,
    description: 'Enable the Human Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableOnboardingAiHero: {
    key: 'enable-onboarding-ai-hero',
    defaultValue:
      parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_AI_HERO) ?? false,
    description: 'Enable AI hero input on onboarding page',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableOnboardingWriteTools: {
    key: 'enable-onboarding-write-tools',
    defaultValue:
      parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_WRITE_TOOLS) ??
      false,
    description: 'Enable onboarding AI write tools for space setup actions',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  enableEcosystemAutomation: {
    key: 'enable-ecosystem-automation',
    defaultValue:
      parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ECOSYSTEM_AUTOMATION) ??
      false,
    description: 'Enable ecosystem blueprint automation tools',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
};

export async function getShowLanguageSelect(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'show-language-select',
    process.env.NEXT_PUBLIC_ENABLE_SHOW_LANGUAGE_SELECT,
    true,
  );
}

async function getBooleanFlagFromToolbarOrEnv(
  toolbarKey: string,
  envValue: string | undefined,
  fallbackDefaultValue: boolean,
): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, toolbarKey);
  if (o !== undefined) return o;

  const env = parseBoolean(envValue);
  if (env !== undefined) return env;

  return fallbackDefaultValue;
}

export async function getEnableAiChat(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-ai-chat',
    process.env.NEXT_PUBLIC_ENABLE_AI_CHAT,
    true,
  );
}

export async function getEnableCoherence(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-coherence',
    process.env.NEXT_PUBLIC_ENABLE_COHERENCE,
    true,
  );
}

/**
 * Human Chat right panel defaults on, but can be disabled via env/toolbar.
 * Kill switch (`HYPHA_DISABLE_HUMAN_CHAT` / `NEXT_PUBLIC_DISABLE_HUMAN_CHAT`) wins.
 */
export async function getEnableHumanChat(): Promise<boolean> {
  const killSwitch = parseBoolean(process.env.HYPHA_DISABLE_HUMAN_CHAT);
  const publicKillSwitch = parseBoolean(
    process.env.NEXT_PUBLIC_DISABLE_HUMAN_CHAT,
  );
  if (killSwitch === true || publicKillSwitch === true) return false;

  return getBooleanFlagFromToolbarOrEnv(
    'enable-human-chat',
    process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT,
    true,
  );
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-space-memory',
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
    true,
  );
}

export async function getEnableOnboardingAiHero(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-onboarding-ai-hero',
    process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_AI_HERO,
    false,
  );
}

export async function getEnableOnboardingWriteTools(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-onboarding-write-tools',
    process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_WRITE_TOOLS,
    false,
  );
}

export async function getEnableEcosystemAutomation(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'enable-ecosystem-automation',
    process.env.NEXT_PUBLIC_ENABLE_ECOSYSTEM_AUTOMATION,
    false,
  );
}
