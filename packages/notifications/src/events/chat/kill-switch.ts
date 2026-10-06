/**
 * Global kill switch for the all-messages default (#2470 D1 / D10): `chat.message` pushes go to every
 * room member, so a volume spike in prod needs a fast way off that doesn't touch mentions.
 * Follows the `HYPHA_DISABLE_*` env pattern (cf. `HYPHA_DISABLE_HUMAN_CHAT`); off by default. On
 * Vercel an env change still needs the Deploy Production workflow re-run to take effect.
 */
export function isChatMessageNotificationsDisabled(): boolean {
  const raw =
    process.env.HYPHA_DISABLE_CHAT_MESSAGE_NOTIFICATIONS?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
