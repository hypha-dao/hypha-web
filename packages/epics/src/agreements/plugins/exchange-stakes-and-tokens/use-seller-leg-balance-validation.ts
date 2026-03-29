'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
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

/**
 * When a seller row has both amount and token, compare to on-chain balance and
 * set `sellerLeg[i].amount` error (shown under the row).
 */
export function useSellerLegBalanceValidation(
  tSellerAmountExceedsBalance: string,
) {
  const { control, setError, clearErrors } = useFormContext<FormSlice>();

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
    const legs = sellerLeg ?? [];
    const owner = resolveSellerBalanceOwner({
      sellerRecipientType,
      sellerAddress: sellerAddress ?? '',
      sellerLeg: legs,
      spaceExecutorAddress,
    });

    if (owner === 'treasury_unavailable' || owner === null) {
      for (let i = 0; i < legs.length; i++) {
        clearErrors(`sellerLeg.${i}.amount` as const);
      }
      return;
    }

    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const trimmed = leg?.amount?.trim() ?? '';
        const hasToken = !!leg?.token && /^0x[a-fA-F0-9]{40}$/i.test(leg.token);

        if (!trimmed || !hasToken) {
          clearErrors(`sellerLeg.${i}.amount` as const);
          continue;
        }

        const result = await checkSingleSellerLegBalance(owner, leg);
        if (cancelled) return;

        if (result === 'exceeds') {
          setError(`sellerLeg.${i}.amount` as const, {
            type: 'manual',
            message: tSellerAmountExceedsBalance,
          });
        } else {
          clearErrors(`sellerLeg.${i}.amount` as const);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    validationKey,
    tSellerAmountExceedsBalance,
    clearErrors,
    setError,
    sellerLeg,
    sellerRecipientType,
    sellerAddress,
    spaceExecutorAddress,
  ]);
}
