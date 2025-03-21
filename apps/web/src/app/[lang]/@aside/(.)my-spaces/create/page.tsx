'use client';

import { CreateSpaceForm, createSpaceSchema } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';
import { useAccount, useWriteContract } from 'wagmi';
import { z } from 'zod';

import React from 'react';
import invariant from 'tiny-invariant';
import { createSpace } from '@hypha-platform/core-evm';
import { base } from '@wagmi/core/chains';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from 'packages/core-evm/src/generated';
import { useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useAuthentication } from '@hypha-platform/authentication';

export default function Loading() {
  const { lang } = useParams();

  const { wallets } = useWallets();
  const { user } = useAuthentication();

  const { setActiveWallet } = useSetActiveWallet();

  const { address } = useAccount();
  console.debug('CreateSpacePage', { address });
  const { data: hash, isPending, writeContract } = useWriteContract();

  const handleCreateSpace = React.useCallback(
    async ({
      unity,
      quorum,
      votingPowerSource,
      exitMethod,
      joinMethod,
    }: z.infer<typeof createSpaceSchema>) => {
      const activeWallet = wallets.find(
        (wallet) => wallet.address === user?.wallet?.address,
      );
      invariant(activeWallet, 'User needs to be connected');

      await setActiveWallet(activeWallet);

      writeContract({
        address: daoSpaceFactoryImplementationAddress[base.id],
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'createSpace',
        args: [
          {
            unity: BigInt(unity),
            quorum: BigInt(quorum),
            votingPowerSource: BigInt(votingPowerSource),
            exitMethod: BigInt(exitMethod),
            joinMethod: BigInt(joinMethod),
          },
        ],
      });
    },
    [writeContract],
  );

  return (
    <SidePanel>
      <CreateSpaceForm
        isLoading={false}
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={`/${lang}/my-spaces`}
        onCreate={handleCreateSpace}
      />
      {hash && <div>Transaction Hash: {hash}</div>}
    </SidePanel>
  );
}
