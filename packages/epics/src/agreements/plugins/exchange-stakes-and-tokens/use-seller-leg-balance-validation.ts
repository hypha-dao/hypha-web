'use client';

import React from 'react';
import { useFormContext, useWatch, useFormState } from 'react-hook-form';
import {
  checkSingleSellerLegBalance,
  resolveSellerBalanceOwner,
} from '../../../governance/utils/validate-exchange-seller-balances';

type SellerLeg = { amount: string; token: string };

type FormSlice = {
  sellerLeg?: SellerLeg[];
  sellerRecipientType?: 'member' | 'space';
  sellerAddress?: string;
  spaceExecutorAddress?: string;
};

type Messages = {
  exceedsBalance: string;
  amountTooSmall: string;
};

const DEBOUNCE_MS = 450;

/**
 * When a seller row has both amount and token, compare to on-chain balance and
 * set `sellerLeg[i].amount` error (shown under the row).
 * Debounced and disabled during submit so RPC does not race the wallet flow.
 */
export function useSellerLegBalanceValidation(messages: Messages | string) {
  // Backwards-compat: legacy callers pass a single "exceeds balance" string.
  const normalizedMessages: Messages =
    typeof messages === 'string'
      ? { exceedsBalance: messages, amountTooSmall: messages }
      : messages;
  const { control, setError, clearErrors, getFieldState, formState } =
    useFormContext<FormSlice>();
  const { isSubmitting } = useFormState({ control });
  const runSeqRef = React.useRef(0);
  /** Latest formState for getFieldState without putting formState in useCallback deps (would retrigger the effect every render). */
  const formStateRef = React.useRef(formState);
  formStateRef.current = formState;

  /** Only clear balance (`manual`) errors — never strip Zod resolver errors on the same field. */
  const clearManualSellerLegAmountError = React.useCallback(
    (index: number) => {
      const name = `sellerLeg.${index}.amount` as const;
      const { error } = getFieldState(name, formStateRef.current);
      if (error?.type === 'manual') {
        clearErrors(name);
      }
    },
    [clearErrors, getFieldState],
  );

  const sellerLeg = useWatch({ control, name: 'sellerLeg' }) as
    | SellerLeg[]
    | undefined;
  const sellerRecipientType = useWatch({
    control,
    name: 'sellerRecipientType',
  });
  const sellerAddress = useWatch({ control, name: 'sellerAddress' }) as
    | string
    | undefined;
  const spaceExecutorAddress = useWatch({
    control,
    name: 'spaceExecutorAddress',
  }) as string | undefined;

  const messagesRef = React.useRef(normalizedMessages);
  messagesRef.current = normalizedMessages;

  const validationKey = React.useMemo(
    () =>
      JSON.stringify({
        sellerLeg,
        sellerRecipientType,
        sellerAddress,
        spaceExecutorAddress,
      }),
    [sellerLeg, sellerRecipientType, sellerAddress, spaceExecutorAddress],
  );

  React.useEffect(() => {
    if (isSubmitting) {
      return;
    }

    const legs = sellerLeg ?? [];
    const owner = resolveSellerBalanceOwner({
      sellerRecipientType,
      sellerAddress: sellerAddress ?? '',
      sellerLeg: legs,
      spaceExecutorAddress,
    });

    if (owner === 'treasury_unavailable' || owner === null) {
      for (let i = 0; i < legs.length; i++) {
        clearManualSellerLegAmountError(i);
      }
      return;
    }

    runSeqRef.current += 1;
    const seq = runSeqRef.current;

    const timer = window.setTimeout(() => {
      void (async () => {
        for (let i = 0; i < legs.length; i++) {
          if (seq !== runSeqRef.current) return;

          const leg = legs[i];
          const trimmed = leg?.amount?.trim() ?? '';
          const hasToken =
            !!leg?.token && /^0x[a-fA-F0-9]{40}$/i.test(leg.token);

          if (!trimmed || !hasToken) {
            clearManualSellerLegAmountError(i);
            continue;
          }

          const result = await checkSingleSellerLegBalance(owner, leg);
          if (seq !== runSeqRef.current) return;

          const { exceedsBalance, amountTooSmall } = messagesRef.current;
          if (result === 'exceeds') {
            setError(`sellerLeg.${i}.amount` as const, {
              type: 'manual',
              message: exceedsBalance,
            });
          } else if (result === 'amount_too_small') {
            setError(`sellerLeg.${i}.amount` as const, {
              type: 'manual',
              message: amountTooSmall,
            });
          } else {
            clearManualSellerLegAmountError(i);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      runSeqRef.current += 1;
    };
  }, [
    validationKey,
    isSubmitting,
    clearManualSellerLegAmountError,
    setError,
    sellerLeg,
    sellerRecipientType,
    sellerAddress,
    spaceExecutorAddress,
  ]);
}
