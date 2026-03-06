'use client';

import { EthAddress } from '../../../people';
import { usePersonByWeb3Address } from '../../hooks';

interface TokenBackingVaultWhitelistAddressItemProps {
  address: string;
}

export function TokenBackingVaultWhitelistAddressItem({
  address,
}: TokenBackingVaultWhitelistAddressItemProps) {
  const { person } = usePersonByWeb3Address(address as `0x${string}`);
  return (
    <div className="flex gap-2 text-1">
      {person ? (
        <span>
          {person.name} {person.surname}
        </span>
      ) : (
        <EthAddress address={address} />
      )}
    </div>
  );
}
