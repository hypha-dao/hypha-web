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
    address: (space?.address ?? '0x0') as `0x${string}`,
  });

  const isPaymentExpired = isStatusLoading ? true : status === 'expired';

  return { space, isPaymentExpired, fundWallet, isStatusLoading };
};
