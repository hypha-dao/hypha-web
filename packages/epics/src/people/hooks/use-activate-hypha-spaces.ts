'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { ActivateSpacesFormValues } from './validation';
import {
  useActivateSpacesMutation,
  assertOnChainSpaceRenewalSupported,
  getSpaceActivationBreakdown,
  getSpaceActivationPaymentAmounts,
  getSpaceActivationTotal,
  type UsdRates,
} from '@hypha-platform/core/client';

const RATES_ENDPOINT = '/api/v1/currency-rates';

const fetchRates = (endpoint: string): Promise<{ rates: UsdRates }> =>
  fetch(endpoint).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch currency rates');
    return res.json();
  });

export const useActivateSpaces = ({
  spaces,
  paymentToken,
}: {
  spaces: ActivateSpacesFormValues['spaces'] | undefined;
  paymentToken: ActivateSpacesFormValues['paymentToken'] | undefined;
}) => {
  const { activateSpaces, isActivating, activationTxHash, activationError } =
    useActivateSpacesMutation();

  const { data, isLoading: isEurRateLoading } = useSWR(
    RATES_ENDPOINT,
    fetchRates,
    {
      refreshInterval: 60 * 60 * 1000,
      revalidateOnFocus: false,
    },
  );

  const breakdown = useMemo(
    () => getSpaceActivationBreakdown(spaces ?? [], data?.rates ?? {}),
    [spaces, data?.rates],
  );

  const total = getSpaceActivationTotal(breakdown, paymentToken ?? 'HYPHA');

  const submitActivation = async () => {
    const token = paymentToken ?? 'HYPHA';
    assertOnChainSpaceRenewalSupported(token);

    const filtered = breakdown.items.filter((item) => item.spaceId);
    const spaceIds = filtered.map((item) => BigInt(item.spaceId));
    const amounts = getSpaceActivationPaymentAmounts(
      { ...breakdown, items: filtered },
      token,
    );

    return await activateSpaces({
      spaceIds,
      amounts,
      paymentToken: token,
    });
  };

  return {
    totalUSDC: breakdown.totalUSDC,
    totalHYPHA: breakdown.totalHYPHA,
    totalEURC: breakdown.totalEURC,
    eurcRateReady: breakdown.totalEURC != null,
    isEurRateLoading,
    total,
    paymentToken,
    breakdown: breakdown.items,
    submitActivation,
    isActivating,
    activationTxHash,
    activationError,
  };
};
