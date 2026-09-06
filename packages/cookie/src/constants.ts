export const HYPHA_LOCALE = 'HYPHA_LOCALE';
export const HYPHA_SHOW_LANGUAGE_SELECT = 'HYPHA_SHOW_LANGUAGE_SELECT';
export const HYPHA_ENABLE_AI_CHAT = 'HYPHA_ENABLE_AI_CHAT';
export const HYPHA_ENABLE_HUMAN_CHAT = 'HYPHA_ENABLE_HUMAN_CHAT';
/** When `true`, hides Human Chat and disables Matrix token issuance (emergency kill switch). */
export const HYPHA_DISABLE_HUMAN_CHAT = 'HYPHA_DISABLE_HUMAN_CHAT';
export const HYPHA_ENABLE_COHERENCE = 'HYPHA_ENABLE_COHERENCE';
export const HYPHA_ENABLE_SPACE_MEMORY = 'HYPHA_ENABLE_SPACE_MEMORY';
/**
 * Persisted interaction-mode choice for the #2486 talk-first entrypoint.
 * `'classic'` = user opted out of Coherent; the coherent-first redirect is then
 * suppressed. Absent / `'coherent'` = default (coherent-first when
 * `enable-coherent-intelligent-system` is on).
 */
export const HYPHA_COHERENT_MODE = 'HYPHA_COHERENT_MODE';
/** IANA timezone persisted from the browser for server-side date formatting. */
export const HYPHA_TIMEZONE = 'HYPHA_TIMEZONE';
