export type BridgeEndorsementOption = {
  value: string;
  labelKey: string;
};

/** Values must match `bridgeEndorsementSchema` in core banking Bridge provider. */
export const BRIDGE_ENDORSEMENT_OPTIONS: BridgeEndorsementOption[] = [
  { value: 'base', labelKey: 'base' },
  { value: 'sepa', labelKey: 'sepa' },
  { value: 'faster_payments', labelKey: 'faster_payments' },
  { value: 'pix', labelKey: 'pix' },
  { value: 'spei', labelKey: 'spei' },
  { value: 'cop', labelKey: 'cop' },
];

/** Default selection (USD + EUR) — matches `DEFAULT_BRIDGE_KYC_ENDORSEMENTS` in core. */
export const DEFAULT_BRIDGE_ENDORSEMENT_VALUES = ['base', 'sepa'] as const;
