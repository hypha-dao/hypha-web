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
  tokenType,
  spaceSlug,
  maxSupplyTypeReadOnly = false,
  membersForOwnershipWhitelist,
  spacesForOwnershipWhitelist,
}: {
  enableLimitedSupply: boolean;
  setEnableLimitedSupply: (value: boolean) => void;
  enableProposalAutoMinting: boolean;
  transferable: boolean;
  enableAdvancedTransferControls: boolean;
  enableTokenPrice: boolean;
  members: Person[];
  spaces: Space[];
  tokenType?: string;
  spaceSlug?: string;
  maxSupplyTypeReadOnly?: boolean;
  membersForOwnershipWhitelist?: Person[];
  spacesForOwnershipWhitelist?: Space[];
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
        tokenType={tokenType}
        spaceSlug={spaceSlug}
        membersForOwnershipWhitelist={membersForOwnershipWhitelist}
        spacesForOwnershipWhitelist={spacesForOwnershipWhitelist}
      />
      <Separator />
      <TokenValueSection enableTokenPrice={enableTokenPrice} />
    </>
  );
};
