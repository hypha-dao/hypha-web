'use client';

import { useEffect, useRef } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { TokenPayoutField } from '../agreements/plugins/components/common/token-payout-field';
import { useTokens } from '../treasury/hooks/use-tokens';

export type LinkedTreasuryPayout = {
  amount: string;
  token: string;
};

const EMPTY_PAYOUT: LinkedTreasuryPayout = { amount: '', token: '' };

function payoutRows(
  payout: LinkedTreasuryPayout | readonly LinkedTreasuryPayout[],
): readonly LinkedTreasuryPayout[] {
  return Array.isArray(payout) ? payout : [payout];
}

/** Amount and token pairs the create-signal form can prefill. Either may be absent. */
export function appendIndicativePayoutParams(
  params: URLSearchParams,
  payout: LinkedTreasuryPayout | readonly LinkedTreasuryPayout[],
) {
  for (const row of payoutRows(payout)) {
    const amount = row.amount.trim();
    const token = row.token.trim();
    const amountOk = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
    const tokenOk = /^0x[a-fA-F0-9]{40}$/.test(token);
    if (!amountOk && !tokenOk) continue;
    // Keep pairs aligned when one side is still empty.
    params.append('amount', amountOk ? amount : '');
    params.append('token', tokenOk ? token : '');
  }
}

/**
 * Token-and-amount rows the signal form uses. Several tokens can be added.
 * The catalogue follows the chosen space, and a space change drops tokens
 * from the previous catalogue.
 */
export function LinkedTreasuryAmountField({
  spaceSlug,
  value,
  onChange,
}: {
  spaceSlug: string;
  value: readonly LinkedTreasuryPayout[];
  onChange: (next: LinkedTreasuryPayout[]) => void;
}) {
  const tAgreement = useTranslations('AgreementFlow');
  const tCommon = useTranslations('Common');
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const catalogue = spaceSlug && !isLoading ? tokens : [];
  const previousSpace = useRef(spaceSlug);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const rows = value.length > 0 ? value : [EMPTY_PAYOUT];

  useEffect(() => {
    if (previousSpace.current === spaceSlug) return;
    previousSpace.current = spaceSlug;
    const current = valueRef.current;
    if (!current.some((row) => row.token)) return;
    onChangeRef.current(current.map((row) => ({ ...row, token: '' })));
  }, [spaceSlug]);

  const updateRow = (index: number, next: LinkedTreasuryPayout) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { amount: next.amount, token: next.token }
          : { amount: row.amount, token: row.token },
      ),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <TokenPayoutField
              stacked
              value={row}
              onChange={(next) => updateRow(index, next)}
              tokens={catalogue}
              isLoadingTokens={Boolean(spaceSlug) && isLoading}
            />
          </div>
          {rows.length > 1 ? (
            <button
              type="button"
              className="mt-1 grid size-8 shrink-0 place-items-center text-neutral-11 hover:text-foreground"
              aria-label={tCommon('remove')}
              onClick={() =>
                onChange(
                  rows
                    .filter((_, rowIndex) => rowIndex !== index)
                    .map((item) => ({
                      amount: item.amount,
                      token: item.token,
                    })),
                )
              }
            >
              <Cross2Icon aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="inline-flex h-8 w-fit items-center gap-1 text-1 text-neutral-11 hover:text-foreground"
        onClick={() =>
          onChange([
            ...rows.map((row) => ({ amount: row.amount, token: row.token })),
            { ...EMPTY_PAYOUT },
          ])
        }
      >
        <PlusIcon aria-hidden />
        {tAgreement('plugins.tokenPayoutFieldArray.add')}
      </button>
    </div>
  );
}
