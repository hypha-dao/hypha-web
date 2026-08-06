import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

// Imported after the env is in place: config reads process.env at module load.
let provider: import('../stripe').StripePaymentProvider;

beforeAll(async () => {
  const { StripePaymentProvider } = await import('../stripe');
  provider = new StripePaymentProvider();
});

function sign(
  payload: string,
  {
    secret = WEBHOOK_SECRET,
    timestamp = Math.floor(Date.now() / 1000),
  }: { secret?: string; timestamp?: number } = {},
) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return { signature, timestamp };
}

function headersFor(payload: string, options?: Parameters<typeof sign>[1]) {
  const { signature, timestamp } = sign(payload, options);
  return new Headers({ 'stripe-signature': `t=${timestamp},v1=${signature}` });
}

function sessionEvent(
  overrides: Record<string, unknown> = {},
  type = 'checkout.session.completed',
) {
  return JSON.stringify({
    id: 'evt_1',
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_123',
        amount_total: 2500,
        currency: 'aud',
        payment_status: 'paid',
        client_reference_id: 'rs_7_abc',
        metadata: { reference: 'rs_7_abc' },
        customer_details: { email: 'member@example.org' },
        ...overrides,
      },
    },
  });
}

describe('stripe mode', () => {
  it('reports the sandbox when given a test key', () => {
    expect(provider.mode).toBe('test');
    expect(provider.isConfigured()).toBe(true);
  });
});

describe('stripe webhook signatures', () => {
  it('accepts a correctly signed payload', async () => {
    const payload = sessionEvent();
    const result = await provider.handleWebhook(payload, headersFor(payload));

    expect(result.ok).toBe(true);
    expect(result.ok && result.event).toMatchObject({
      type: 'payment.completed',
      providerReference: 'cs_test_123',
      reference: 'rs_7_abc',
      amountCents: 2500,
      currency: 'AUD',
      email: 'member@example.org',
    });
  });

  it('rejects a body that changed after signing', async () => {
    const payload = sessionEvent();
    const headers = headersFor(payload);
    const tampered = payload.replace('2500', '250000');

    const result = await provider.handleWebhook(tampered, headers);

    expect(result).toEqual({ ok: false, reason: 'Bad signature' });
  });

  it('rejects a signature made with the wrong secret', async () => {
    const payload = sessionEvent();
    const headers = headersFor(payload, { secret: 'whsec_someone_elses' });

    const result = await provider.handleWebhook(payload, headers);

    expect(result).toEqual({ ok: false, reason: 'Bad signature' });
  });

  it('rejects a replay from outside the tolerance window', async () => {
    const payload = sessionEvent();
    const headers = headersFor(payload, {
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60,
    });

    const result = await provider.handleWebhook(payload, headers);

    expect(result).toEqual({
      ok: false,
      reason: 'Signature timestamp outside tolerance',
    });
  });

  it('accepts when one of several v1 signatures matches, as during rotation', async () => {
    const payload = sessionEvent();
    const { signature, timestamp } = sign(payload);
    const headers = new Headers({
      'stripe-signature': `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`,
    });

    const result = await provider.handleWebhook(payload, headers);

    expect(result.ok).toBe(true);
  });

  it('rejects a payload with no signature header at all', async () => {
    const payload = sessionEvent();

    const result = await provider.handleWebhook(payload, new Headers());

    expect(result).toEqual({
      ok: false,
      reason: 'Missing Stripe-Signature header',
    });
  });
});

describe('stripe event mapping', () => {
  it('ignores a completed session that has not actually been paid', async () => {
    // Delayed methods complete the session first and settle later; granting
    // RSUT here would hand out voting power for money that may never arrive.
    const payload = sessionEvent({ payment_status: 'unpaid' });

    const result = await provider.handleWebhook(payload, headersFor(payload));

    expect(result).toEqual({ ok: true, event: null });
  });

  it('grants once the delayed payment does succeed', async () => {
    const payload = sessionEvent(
      { payment_status: 'unpaid' },
      'checkout.session.async_payment_succeeded',
    );

    const result = await provider.handleWebhook(payload, headersFor(payload));

    expect(result.ok && result.event?.type).toBe('payment.completed');
  });

  it('keys the event on the session id, so a redelivery is the same payment', async () => {
    const payload = sessionEvent();
    const first = await provider.handleWebhook(payload, headersFor(payload));
    const second = await provider.handleWebhook(payload, headersFor(payload));

    expect(first.ok && first.event?.providerReference).toBe('cs_test_123');
    expect(second.ok && second.event?.providerReference).toBe('cs_test_123');
  });

  it('passes over event types the campaign has no use for', async () => {
    const payload = sessionEvent({}, 'payment_intent.created');

    const result = await provider.handleWebhook(payload, headersFor(payload));

    expect(result).toEqual({ ok: true, event: null });
  });

  it('falls back to client_reference_id when metadata is missing', async () => {
    const payload = sessionEvent({ metadata: {} });

    const result = await provider.handleWebhook(payload, headersFor(payload));

    expect(result.ok && result.event?.reference).toBe('rs_7_abc');
  });
});
