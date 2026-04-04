'use client';

import { Person, Space } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { TokenSupplySection } from './token-supply-section';
import { AutoMintSection } from './auto-mint-section';
import { TransferSection } from './transfer-section';
import { TokenValueSection } from './token-value-section';

export const AdvancedTokenSettings = ({
  enableLimitedSupply,
  setEnableLimitedSupply,
  enableProposalAutoMinting,
  transferable,
  enableAdvancedTransferControls,
  enableTokenPrice,
  members,
  spaces,
  ownershipToWhitelistMembers,
  ownershipToWhitelistSpaces,
  tokenType,
  spaceSlug,
  maxSupplyTypeReadOnly = false,
}: {
  enableLimitedSupply: boolean;
  setEnableLimitedSupply: (value: boolean) => void;
  enableProposalAutoMinting: boolean;
  transferable: boolean;
  enableAdvancedTransferControls: boolean;
  enableTokenPrice: boolean;
  members: Person[];
  spaces: Space[];
  /** Ownership token To whitelist: active space members (people) */
  ownershipToWhitelistMembers?: Person[];
  /** Ownership token To whitelist: spaces that are members of the active space */
  ownershipToWhitelistSpaces?: Space[];
  tokenType?: string;
  spaceSlug?: string;
  maxSupplyTypeReadOnly?: boolean;
}) => {
  return (
    <>
      <Separator />
      <TokenSupplySection
        enableLimitedSupply={enableLimitedSupply}
        setEnableLimitedSupply={setEnableLimitedSupply}
        maxSupplyTypeReadOnly={maxSupplyTypeReadOnly}
      />
      <Separator />
      <AutoMintSection enableProposalAutoMinting={enableProposalAutoMinting} />
      <Separator />
      <TransferSection
        transferable={transferable}
        enableAdvancedTransferControls={enableAdvancedTransferControls}
        members={members}
        spaces={spaces}
        ownershipToWhitelistMembers={ownershipToWhitelistMembers}
        ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
        tokenType={tokenType}
        spaceSlug={spaceSlug}
      />
      <Separator />
      <TokenValueSection enableTokenPrice={enableTokenPrice} />
    </>
  );
};
