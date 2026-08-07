'use client';

import { Sparkles, Wallet } from 'lucide-react';

import { useCampaign } from '../_lib/campaign-store';
import { Dialog, RsButton } from './ui';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

export function SignInDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signIn, economics } = useCampaign();

  return (
    <Dialog open={open} onClose={onClose} title="Join the round">
      <p className="rs-prose text-[var(--rs-ink-soft)]">
        Sign in with your Google account or your email. A wallet is created for
        you in the background — there is nothing to install and no transaction
        to sign.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            onClose();
            signIn();
          }}
          className="rs-focus flex w-full items-center justify-center gap-3 rounded-full border border-[var(--rs-line)] bg-[var(--rs-white)] px-6 py-3.5 transition-colors hover:border-[var(--rs-ink)]"
        >
          <GoogleMark />
          <span className="rs-eyebrow">Continue with Google or email</span>
        </button>
      </div>

      <ul className="mt-7 space-y-3 border-t border-[var(--rs-line)] pt-6">
        <li className="rs-ui flex items-start gap-3 text-sm text-[var(--rs-ink-soft)]">
          <Sparkles
            size={16}
            className="mt-0.5 shrink-0 text-[var(--rs-clay)]"
          />
          <span>
            First time here? {economics.joinBonusRsut} RSUT are minted to you as
            a joining bonus.
          </span>
        </li>
        <li className="rs-ui flex items-start gap-3 text-sm text-[var(--rs-ink-soft)]">
          <Wallet size={16} className="mt-0.5 shrink-0 text-[var(--rs-clay)]" />
          <span>
            RSUT is Regen Sydney&rsquo;s utility token on Base. 1 RSUT = A$1 and
            it is yours to keep.
          </span>
        </li>
      </ul>

      <RsButton
        variant="quiet"
        size="sm"
        onClick={onClose}
        className="mt-7 w-full"
      >
        Maybe later
      </RsButton>
    </Dialog>
  );
}
