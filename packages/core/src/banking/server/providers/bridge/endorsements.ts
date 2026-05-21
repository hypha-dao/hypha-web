import { z } from 'zod';

/** Bridge KYC link endorsement types (see Bridge API EndorsementType). */
export const bridgeEndorsementSchema = z.enum([
  'base',
  'cop',
  'faster_payments',
  'pix',
  'sepa',
  'spei',
]);

export type BridgeEndorsement = z.infer<typeof bridgeEndorsementSchema>;

/** Validates provider-agnostic rail ids before calling Bridge. */
export function parseBridgeEndorsements(
  endorsements: string[],
): BridgeEndorsement[] {
  return z.array(bridgeEndorsementSchema).parse(endorsements);
}
