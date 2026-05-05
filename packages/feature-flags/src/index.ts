import {
  getVercelToolbarFlagOverrides,
  readBooleanOverride,
} from './vercel-toolbar-overrides';

const isPreviewEnvironment = () => process.env.VERCEL_ENV === 'preview';
const isEnabled = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
};

/**
 * Default feature exposure:
 * - AI panel: on
 * - Coherence/signals: on
 * - Space memory: off
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
 * `NEXT_PUBLIC_*` env vars and preview defaults apply when there is no override for that key.
 * Without `FLAGS_SECRET`, SSR still works; toolbar overrides are ignored until the
 * secret is configured on the project.
 */
export const flagDefinitionsForDiscovery = {
  showLanguageSelect: {
    key: 'show-language-select',
    defaultValue:
      isPreviewEnvironment() ||
      isEnabled(process.env.NEXT_PUBLIC_ENABLE_SHOW_LANGUAGE_SELECT),
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
    defaultValue: false,
    description:
      'Space Memory on Coherence tab. Opt in: HYPHA_ENABLE_SPACE_MEMORY cookie or NEXT_PUBLIC_ENABLE_SPACE_MEMORY=true',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
  /**
   * Toolbar key matches `readBooleanOverride(..., 'enable-human-chat')`.
   * Discovery `defaultValue` matches {@link getEnableHumanChat} when unset (opt-in).
   */
  enableHumanChat: {
    key: 'enable-human-chat',
    defaultValue: true,
    description: 'Enable the Human Chat panel in space pages',
    origin: 'hypha' as const,
    options: undefined as undefined,
  },
};

export async function getShowLanguageSelect(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnv(
    'show-language-select',
    process.env.NEXT_PUBLIC_ENABLE_SHOW_LANGUAGE_SELECT,
  );
}

async function getBooleanFlagFromToolbarOrEnv(
  toolbarKey: string,
  envValue: string | undefined,
): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnvOrDefault(toolbarKey, envValue, false);
}

async function getBooleanFlagFromToolbarOrEnvOrDefault(
  toolbarKey: string,
  envValue: string | undefined,
  defaultValue: boolean,
): Promise<boolean> {
  const overrides = await getVercelToolbarFlagOverrides();
  const o = readBooleanOverride(overrides, toolbarKey);
  if (o !== undefined) return o;

  if (envValue !== undefined) return isEnabled(envValue);
  return defaultValue;
}

export async function getEnableAiChat(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnvOrDefault(
    'enable-ai-chat',
    process.env.NEXT_PUBLIC_ENABLE_AI_CHAT,
    true,
  );
}

export async function getEnableCoherence(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnvOrDefault(
    'enable-coherence',
    process.env.NEXT_PUBLIC_ENABLE_COHERENCE,
    true,
  );
}

/**
 * Human Chat right panel: **off** by default. Opt in via cookie, `NEXT_PUBLIC_ENABLE_HUMAN_CHAT`,
 * or Vercel toolbar. Kill switch (`HYPHA_DISABLE_HUMAN_CHAT` / `NEXT_PUBLIC_DISABLE_HUMAN_CHAT`) wins.
 */
export async function getEnableHumanChat(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnvOrDefault(
    'enable-human-chat',
    process.env.NEXT_PUBLIC_ENABLE_HUMAN_CHAT,
    true,
  );
}

export async function getEnableSpaceMemory(): Promise<boolean> {
  return getBooleanFlagFromToolbarOrEnvOrDefault(
    'enable-space-memory',
    process.env.NEXT_PUBLIC_ENABLE_SPACE_MEMORY,
    false,
  );
}
