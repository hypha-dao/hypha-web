'use client';

import { Check, CreditCard, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { formatAud } from '@rs/lib/campaign-types';

import { Field, RsButton, inputClass } from '../../_components/ui';

/**
 * Stand-in checkout used while the payment provider is undecided. Pressing pay
 * asks the server to emit a signed `payment.completed` webhook, which is the
 * same event Paddle or Stripe will send — so the grant and the RSUT mint that
 * follow are the real ones, not a simulation.
 */
function MockCheckout() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const amountCents = Number(params.get('amount') ?? 0);
  const email = params.get('email') || null;

  const [state, setState] = useState<'idle' | 'paying' | 'done' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  const pay = async () => {
    setState('paying');
    setMessage(null);
    try {
      const response = await fetch('/api/checkout/mock/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, amountCents, email }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.handled === false) {
        setState('error');
        setMessage(body.error ?? body.reason ?? 'The payment was not recorded');
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setMessage('Could not reach the server');
    }
  };

  if (!reference || !(amountCents > 0)) {
    return (
      <Shell title="Nothing to pay">
        <p className="rs-prose text-[var(--rs-ink-soft)]">
          This checkout link is missing its reference or amount.
        </p>
        <Link href="/">
          <RsButton className="mt-6 w-full">Back to the campaign</RsButton>
        </Link>
      </Shell>
    );
  }

  if (state === 'done') {
    return (
      <Shell title="Thank you">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--rs-aqua)]">
            <Check size={28} className="text-[var(--rs-teal)]" />
          </div>
          <p className="rs-heading mt-6 text-2xl">
            {formatAud(amountCents / 100)} recorded
          </p>
          <p className="rs-prose mt-3 text-[var(--rs-ink-soft)]">
            Your RSUT has been granted and is being minted to your wallet. Head
            back and place your votes.
          </p>
          <Link href="/#projects">
            <RsButton className="mt-7 w-full">Allocate my tokens</RsButton>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Test checkout">
      <div className="rs-ui mb-5 flex items-center justify-between rounded-xl bg-[var(--rs-cream)] px-4 py-3 text-sm">
        <span className="text-[var(--rs-ink-soft)]">Paying</span>
        <span className="rs-heading rs-tabular text-lg">
          {formatAud(amountCents / 100)}
        </span>
      </div>

      <div className="space-y-4">
        <Field label="Card number">
          <input
            className={inputClass}
            defaultValue="4242 4242 4242 4242"
            readOnly
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry">
            <input className={inputClass} defaultValue="04 / 29" readOnly />
          </Field>
          <Field label="CVC">
            <input className={inputClass} defaultValue="123" readOnly />
          </Field>
        </div>
      </div>

      {message ? (
        <p className="rs-ui mt-5 rounded-xl bg-[var(--rs-peach-soft)] p-3 text-sm text-[var(--rs-clay)]">
          {message}
        </p>
      ) : null}

      <RsButton
        className="mt-6 w-full"
        onClick={pay}
        disabled={state === 'paying'}
      >
        {state === 'paying' ? (
          'Processing…'
        ) : (
          <>
            <CreditCard size={14} /> Pay {formatAud(amountCents / 100)}
          </>
        )}
      </RsButton>

      <p className="rs-ui mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--rs-ink-faint)]">
        <Lock size={12} /> Test provider — no money moves. Set
        CAMPAIGN_PAYMENTS_PROVIDER to switch.
      </p>
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--rs-cream)] px-5 py-16">
      <div className="w-full max-w-md rounded-3xl bg-[var(--rs-sand)] p-8 shadow-xl">
        <h1 className="rs-heading mb-6 text-2xl">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<Shell title="Test checkout">Loading…</Shell>}>
      <MockCheckout />
    </Suspense>
  );
}
