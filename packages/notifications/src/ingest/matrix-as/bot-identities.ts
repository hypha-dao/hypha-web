/**
 * MXIDs whose own `m.room.message` events must never produce a notification — the AS bot(s).
 * The bot posts system/relay messages via `matrixSendTextMessage`; those must not notify anyone.
 *
 *  - `NEXT_PUBLIC_MATRIX_BOT_USER_ID`       — this env's bot (set since #2428)
 *  - `HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS` — optional, comma-separated: the *other* environment's
 *                                            bot MXID(s), because Prod+Preview share one Dendrite
 *                                            (#2252). Only their AS *tokens* are configured today,
 *                                            not their MXIDs, so this is opt-in extra hygiene.
 */
export function getSuppressedBotUserIds(): string[] {
  const primary = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim();
  const additional = (process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return [
    ...new Set(
      [primary, ...additional].filter((id): id is string => Boolean(id)),
    ),
  ];
}
