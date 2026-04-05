'use client';

import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSalesBanner } from './use-sales-banner';
import { useFundWallet } from '../../treasury';

export const useActionGating = (spaceSlug: string) => {
  const { space } = useSpaceBySlug(spaceSlug);
  const { status, isLoading: isStatusLoading } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { fundWallet } = useFundWallet({
    address: space?.address as `0x${string}`,
  });

  /** Treat unknown/null status as gated — do not enable actions until status is known. */
  const isPaymentExpired =
    isStatusLoading || status == null || status === 'expired';

  return { space, isPaymentExpired, fundWallet, isStatusLoading };
};
