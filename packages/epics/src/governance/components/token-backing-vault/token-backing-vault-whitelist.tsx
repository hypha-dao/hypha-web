'use client';

import { TokenBackingVaultWhitelistAddressItem } from './token-backing-vault-whitelist-address-item';

interface TokenBackingVaultWhitelistProps {
  addresses: string[];
}

export function TokenBackingVaultWhitelist({
  addresses,
}: TokenBackingVaultWhitelistProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-1 text-neutral-11">Redemption Whitelist Enabled</div>
      <div className="flex flex-col gap-1">
        {addresses.map((addr, i) => (
          <TokenBackingVaultWhitelistAddressItem key={i} address={addr} />
        ))}
      </div>
    </div>
  );
}
