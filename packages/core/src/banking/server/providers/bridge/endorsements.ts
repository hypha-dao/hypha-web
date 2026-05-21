import { z } from 'zod';

/**
 * Bridge `EndorsementType` on POST /v0/kyc_links (not virtual-account payment_rail).
 * @see https://apidocs.bridge.xyz/api-reference/kyc-links/generate-the-links-needs-to-complete-kyc-for-an-individual-or-business
 */
export const bridgeEndorsementSchema = z.enum([
  'base',
  'cards',
  'cop',
  'faster_payments',
  'pix',
  'sepa',
  'spei',
]);

export type BridgeEndorsement = z.infer<typeof bridgeEndorsementSchema>;

/**
 * Default endorsements when none are chosen (USD + EUR). USD uses `base`, not `ach`.
 */
export const DEFAULT_BRIDGE_KYC_ENDORSEMENTS: BridgeEndorsement[] = [
  'base',
  'sepa',
];

/** Validates endorsement ids before calling Bridge. */
export function parseBridgeEndorsements(
  endorsements: string[],
): BridgeEndorsement[] {
  return z.array(bridgeEndorsementSchema).parse(endorsements);
}

export function resolveBridgeKycEndorsements(
  endorsements: string[] | undefined,
): BridgeEndorsement[] {
  if (endorsements?.length) {
    return parseBridgeEndorsements(endorsements);
  }
  return [...DEFAULT_BRIDGE_KYC_ENDORSEMENTS];
}
