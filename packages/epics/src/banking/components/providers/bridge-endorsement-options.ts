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
