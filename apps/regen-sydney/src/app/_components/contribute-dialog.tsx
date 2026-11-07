'use client';

import { AlertCircle, CreditCard, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../_lib/cn';

import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';
import { Dialog, Field, RsButton, inputClass } from './ui';

const PRESETS = [25, 50, 100, 250, 500, 1000];

export function ContributeDialog({
  open,
  onClose,
  onRequireSignIn,
}: {
  open: boolean;
  onClose: () => void;
  onRequireSignIn: () => void;
}) {
  const { user, contribute, cycle, economics } = useCampaign();
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [processing, setProcessing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setProcessing(false);
      setFailure(null);
      setCustom('');
      setAmount(100);
    }
  }, [open]);

  const effectiveAmount = custom ? Math.max(0, Number(custom) || 0) : amount;
  const matchAud = effectiveAmount * cycle.matchMultiplier;
  const rsut = effectiveAmount * economics.rsutPerAud;
  const belowMinimum = effectiveAmount < economics.minContributionAud;

  /**
   * The checkout is created server-side and the browser is handed off to the
   * provider. Voting power appears only once their webhook confirms the money
   * settled, so there is nothing optimistic to do here.
   */
  const handleCheckout = async () => {
    if (!user) {
      onClose();
      onRequireSignIn();
      return;
    }

    setProcessing(true);
    setFailure(null);
    try {
      const session = await contribute(effectiveAmount);
      if (session.url) {
        window.location.assign(session.url);
        return;
      }
      setFailure(
        'The payment provider did not return a checkout link. Please try again.',
      );
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Could not start the checkout',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Contribute to the round">
      <p className="rs-prose text-[var(--rs-ink-soft)]">
        Every A$1 is matched {cycle.matchMultiplier}:1 by our philanthropic
        partners and becomes {economics.rsutPerAud} RSUT of voting power in your
        hands.
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
            min={economics.minContributionAud}
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
            <dd className="rs-tabular">{formatAud(matchAud)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--rs-aqua)] pt-2">
            <dt className="text-[var(--rs-ink)]">Voting tokens you get</dt>
            <dd className="rs-heading rs-tabular">{formatNumber(rsut)} RSUT</dd>
          </div>
        </dl>
      </div>

      {failure ? (
        <p className="rs-ui mt-5 flex items-start gap-2 rounded-xl bg-[var(--rs-peach-soft)] p-3 text-sm text-[var(--rs-clay)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {failure}
        </p>
      ) : null}

      <RsButton
        className="mt-6 w-full"
        disabled={belowMinimum || processing}
        onClick={handleCheckout}
      >
        {processing ? (
          'Opening checkout…'
        ) : (
          <>
            <CreditCard size={14} /> Contribute {formatAud(effectiveAmount)}
          </>
        )}
      </RsButton>

      {belowMinimum ? (
        <p className="rs-ui mt-3 text-center text-xs text-[var(--rs-ink-faint)]">
          The minimum contribution is {formatAud(economics.minContributionAud)}.
        </p>
      ) : null}

      <p className="rs-ui mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--rs-ink-faint)]">
        <Lock size={12} /> Donations of $2 or more are tax-deductible for
        Australian taxpayers.
      </p>
    </Dialog>
  );
}
