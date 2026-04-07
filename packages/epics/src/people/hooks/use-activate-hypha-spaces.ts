'use client';

import { ActivateSpacesFormValues } from './validation';
import { useActivateSpacesMutation } from '@hypha-platform/core/client';

const HYPHA_PRICE_USD = 0.25;
const HYPHA_PER_MONTH = 44;

export const useActivateSpaces = ({
  spaces,
  paymentToken,
}: {
  spaces: ActivateSpacesFormValues['spaces'];
  paymentToken: ActivateSpacesFormValues['paymentToken'];
}) => {
  const { activateSpaces, isActivating, activationTxHash, activationError } =
    useActivateSpacesMutation();

  let totalUSDC = 0;
  let totalHYPHA = 0;

  const breakdown = spaces.map(({ spaceId, months }) => {
    const hypha = months * HYPHA_PER_MONTH;
    const usdc = +(hypha * HYPHA_PRICE_USD).toFixed(4);

    totalUSDC += usdc;
    totalHYPHA += hypha;

    return {
      spaceId,
      usdc,
      hypha,
    };
  });

  const total = paymentToken === 'HYPHA' ? totalHYPHA : totalUSDC;

  const submitActivation = async () => {
    const filtered = breakdown.filter((b) => b.spaceId);

    const spaceIds = filtered.map((b) => BigInt(b.spaceId));
    const amounts =
      paymentToken === 'USDC'
        ? filtered.map((b) => b.usdc)
        : filtered.map((b) => b.hypha);

    return await activateSpaces({
      spaceIds,
      amounts,
      paymentToken,
    });
  };

  return {
    totalUSDC: +totalUSDC.toFixed(4),
    totalHYPHA: +totalHYPHA.toFixed(4),
    total,
    paymentToken,
    breakdown,
    submitActivation,
    isActivating,
    activationTxHash,
    activationError,
  };
};
