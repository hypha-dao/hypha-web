/**
 * UI constants for Token Backing Vault form.
 * When integrating with contract, switch to CURRENCY_FEED_OPTIONS and
 * MAX_REDEMPTION_PERIOD_OPTIONS from @hypha-platform/core/client.
 */

export const CURRENCY_FEED_OPTIONS = [
  { value: '0x0000000000000000000000000000000000000000', label: 'USD' },
  { value: '0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F', label: 'EUR' },
  { value: '0xCceA6576904C118037695eB71195a5425E69Fa15', label: 'GBP' },
  { value: '0xA840145F87572E82519d578b1F36340368a25D5d', label: 'CAD' },
  { value: '0x3A1d6444fb6a402470098E23DaD0B7E86E14252F', label: 'CHF' },
  { value: '0x46e51B8cA41d709928EdA9Ae43e42193E6CDf229', label: 'AUD' },
] as const

export const MAX_REDEMPTION_PERIOD_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const
