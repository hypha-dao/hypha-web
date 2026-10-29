import 'server-only';

import { getPaymentProviderId } from '../config';
import { MockPaymentProvider } from './mock';
import { PaddlePaymentProvider } from './paddle';
import { StripePaymentProvider } from './stripe';
import type { PaymentProvider } from './provider';

const registry: Record<string, () => PaymentProvider> = {
  mock: () => new MockPaymentProvider(),
  paddle: () => new PaddlePaymentProvider(),
  stripe: () => new StripePaymentProvider(),
};

/** The provider named by `CAMPAIGN_PAYMENTS_PROVIDER`, defaulting to `mock`. */
export function getPaymentProvider(): PaymentProvider {
  const id = getPaymentProviderId();
  return (registry[id] ?? registry.mock!)();
}

export * from './provider';
export { signMockPayload } from './mock';
