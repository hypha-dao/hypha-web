'use client';

import { Person, Space } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { TokenSupplySection } from './token-supply-section';
import { AutoMintSection } from './auto-mint-section';
import { TransferSection } from './transfer-section';
import { TokenValueSection } from './token-value-section';
import { MutualCreditSection } from './mutual-credit-section';
import { AuthorizedMintersSection } from './authorized-minters-section';

const REGULAR_TOKEN_TYPES = new Set([
  'utility',
  'credits',
  'impact',
  'community_currency',
]);

export const AdvancedTokenSettings = ({
  enableLimitedSupply,
  setEnableLimitedSupply,
  enableProposalAutoMinting,
  transferable,
  enableAdvancedTransferControls,
  enableTokenPrice,
  enableMutualCredit = false,
  setEnableMutualCredit,
  members,
  spaces,
  ownershipToWhitelistMembers,
  ownershipToWhitelistSpaces,
  tokenType,
  spaceSlug,
  currentSpaceWeb3Id,
  maxSupplyTypeReadOnly = false,
  authorizedMintersMode = 'create',
}: {
  enableLimitedSupply: boolean;
  setEnableLimitedSupply: (value: boolean) => void;
  enableProposalAutoMinting: boolean;
  transferable: boolean;
  enableAdvancedTransferControls: boolean;
  enableTokenPrice: boolean;
  enableMutualCredit?: boolean;
  setEnableMutualCredit?: (value: boolean) => void;
  members: Person[];
  spaces: Space[];
  /** Ownership token To whitelist: active space members (people) */
  ownershipToWhitelistMembers?: Person[];
  /** Ownership token To whitelist: spaces that are members of the active space */
  ownershipToWhitelistSpaces?: Space[];
  tokenType?: string;
  spaceSlug?: string;
  /** Web3 id of the issuing space; used as the auto-included credit-whitelist entry. */
  currentSpaceWeb3Id?: number | null;
  maxSupplyTypeReadOnly?: boolean;
  /** `create` → initial minters list; `update` → grant + revoke lists. */
  authorizedMintersMode?: 'create' | 'update';
}) => {
  const showMutualCredit =
    typeof tokenType === 'string' &&
    REGULAR_TOKEN_TYPES.has(tokenType) &&
    typeof setEnableMutualCredit === 'function';
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
      {showMutualCredit && setEnableMutualCredit ? (
        <>
          <Separator />
          <MutualCreditSection
            enableMutualCredit={enableMutualCredit}
            setEnableMutualCredit={setEnableMutualCredit}
            spaces={spaces}
            currentSpaceWeb3Id={currentSpaceWeb3Id}
          />
        </>
      ) : null}
      <Separator />
      <AuthorizedMintersSection mode={authorizedMintersMode} />
    </>
  );
};
