'use client';

import { useEffect, useRef } from 'react';
import { TokenPayoutField } from '../agreements/plugins/components/common/token-payout-field';
import { useTokens } from '../treasury/hooks/use-tokens';

export type LinkedTreasuryPayout = {
  amount: string;
  token: string;
};

/** Amount and token the create-signal form can prefill. Either may be absent. */
export function appendIndicativePayoutParams(
  params: URLSearchParams,
  payout: LinkedTreasuryPayout,
) {
  const amount = payout.amount.trim();
  const token = payout.token.trim();
  if (/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) {
    params.set('amount', amount);
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(token)) {
    params.set('token', token);
  }
}

/**
 * Same token-and-amount row the signal form uses. The catalogue follows the
 * chosen space, and a space change drops a token from the previous catalogue.
 */
export function LinkedTreasuryAmountField({
  spaceSlug,
  value,
  onChange,
}: {
  spaceSlug: string;
  value: LinkedTreasuryPayout;
  onChange: (next: LinkedTreasuryPayout) => void;
}) {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const catalogue = spaceSlug && !isLoading ? tokens : [];
  const previousSpace = useRef(spaceSlug);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (previousSpace.current === spaceSlug) return;
    previousSpace.current = spaceSlug;
    if (!valueRef.current.token) return;
    onChangeRef.current({ amount: valueRef.current.amount, token: '' });
  }, [spaceSlug]);

  return (
    <TokenPayoutField
      value={value}
      onChange={(next) => onChange({ amount: next.amount, token: next.token })}
      tokens={catalogue}
      isLoadingTokens={Boolean(spaceSlug) && isLoading}
    />
  );
}
