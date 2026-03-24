'use client';

import { TokenBackingVaultWhitelistAddressItem } from './token-backing-vault-whitelist-address-item';
import { useTranslations } from 'next-intl';

interface TokenBackingVaultWhitelistProps {
  addresses: string[];
}

export function TokenBackingVaultWhitelist({
  addresses,
}: TokenBackingVaultWhitelistProps) {
  const tProposalDetails = useTranslations('ProposalDetails');
  return (
    <div className="flex flex-col gap-2">
      <div className="text-1 text-neutral-11">
        {tProposalDetails('labels.redemptionWhitelistEnabled')}
      </div>
      <div className="flex flex-col gap-1">
        {addresses.map((addr) => (
          <TokenBackingVaultWhitelistAddressItem key={addr} address={addr} />
        ))}
      </div>
    </div>
  );
}
