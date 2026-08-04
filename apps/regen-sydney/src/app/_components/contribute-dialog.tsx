'use client';

import { Check, CreditCard, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../_lib/cn';

import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';
import { Dialog, Field, RsButton, inputClass } from './ui';

const PRESETS = [25, 50, 100, 250, 500, 1000];

type Step = 'amount' | 'checkout' | 'done';

export function ContributeDialog({
  open,
  onClose,
  onRequireSignIn,
}: {
  open: boolean;
  onClose: () => void;
  onRequireSignIn: () => void;
}) {
  const { user, contribute } = useCampaign();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('amount');
      setProcessing(false);
      setCustom('');
      setAmount(100);
    }
  }, [open]);

  const effectiveAmount = custom ? Math.max(0, Number(custom) || 0) : amount;

  const handlePay = () => {
    setProcessing(true);
    // Stands in for the Paddle Checkout round trip and the webhook that mints RSUT.
    setTimeout(() => {
      contribute(effectiveAmount);
      setProcessing(false);
      setStep('done');
    }, 1100);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === 'done' ? 'Thank you' : 'Contribute to the round'}
    >
      {step === 'amount' ? (
        <>
          <p className="rs-prose text-[var(--rs-ink-soft)]">
            Every A$1 is matched 1:1 by our philanthropic partners and becomes 1
            RSUT of voting power in your hands.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset);
                  setCustom('');
                }}
                className={cn(
                  'rs-heading rs-focus rounded-xl border py-3 text-lg transition-colors',
                  !custom && amount === preset
                    ? 'border-[var(--rs-clay)] bg-[var(--rs-peach)]'
                    : 'border-[var(--rs-line)] bg-[var(--rs-white)] hover:border-[var(--rs-ink)]',
                )}
              >
                ${preset}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Field label="Or enter your own amount">
              <input
                type="number"
                min={2}
                inputMode="decimal"
                placeholder="A$"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl bg-[var(--rs-aqua-soft)] p-4">
            <dl className="rs-ui space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--rs-ink-soft)]">Your contribution</dt>
                <dd className="rs-tabular">{formatAud(effectiveAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--rs-ink-soft)]">Partner match</dt>
                <dd className="rs-tabular">{formatAud(effectiveAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--rs-aqua)] pt-2">
                <dt className="text-[var(--rs-ink)]">Voting tokens you get</dt>
                <dd className="rs-heading rs-tabular">
                  {formatNumber(effectiveAmount)} RSUT
                </dd>
              </div>
            </dl>
          </div>

          <RsButton
            className="mt-6 w-full"
            disabled={effectiveAmount < 2}
            onClick={() => {
              if (!user) {
                onClose();
                onRequireSignIn();
                return;
              }
              setStep('checkout');
            }}
          >
            Continue to checkout
          </RsButton>

          <p className="rs-ui mt-4 text-center text-xs text-[var(--rs-ink-faint)]">
            Donations of $2 or more are tax-deductible for Australian taxpayers.
          </p>
        </>
      ) : null}

      {step === 'checkout' ? (
        <>
          <div className="rs-ui mb-5 flex items-center justify-between rounded-xl bg-[var(--rs-cream)] px-4 py-3 text-sm">
            <span className="text-[var(--rs-ink-soft)]">Paying</span>
            <span className="rs-heading rs-tabular text-lg">
              {formatAud(effectiveAmount)}
            </span>
          </div>

          <div className="space-y-4">
            <Field label="Card number">
              <input
                className={inputClass}
                placeholder="4242 4242 4242 4242"
                defaultValue="4242 4242 4242 4242"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry">
                <input
                  className={inputClass}
                  placeholder="MM / YY"
                  defaultValue="04 / 29"
                />
              </Field>
              <Field label="CVC">
                <input
                  className={inputClass}
                  placeholder="123"
                  defaultValue="123"
                />
              </Field>
            </div>
          </div>

          <RsButton
            className="mt-6 w-full"
            onClick={handlePay}
            disabled={processing}
          >
            {processing ? (
              'Processing…'
            ) : (
              <>
                <CreditCard size={14} /> Pay {formatAud(effectiveAmount)}
              </>
            )}
          </RsButton>

          <p className="rs-ui mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--rs-ink-faint)]">
            <Lock size={12} /> Mock checkout — Paddle will handle this for real
          </p>
        </>
      ) : null}

      {step === 'done' ? (
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--rs-aqua)]">
            <Check size={28} className="text-[var(--rs-teal)]" />
          </div>
          <p className="rs-heading mt-6 text-2xl">
            {formatNumber(effectiveAmount)} RSUT minted
          </p>
          <p className="rs-prose mt-3 text-[var(--rs-ink-soft)]">
            Your tokens are in your wallet and your voting power has gone up.
            Head to the projects and place them where they matter most.
          </p>
          <RsButton
            className="mt-7 w-full"
            onClick={() => {
              onClose();
              document
                .getElementById('projects')
                ?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Allocate my tokens
          </RsButton>
        </div>
      ) : null}
    </Dialog>
  );
}
