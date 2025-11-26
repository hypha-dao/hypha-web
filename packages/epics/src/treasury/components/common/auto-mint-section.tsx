import { FormLabel } from '@hypha-platform/ui';
import { EnableProposalAutoMintingField } from './enable-proposal-auto-minting-field';

export const AutoMintSection = ({
  enableProposalAutoMinting,
}: {
  enableProposalAutoMinting: boolean;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Auto-Mint Tokens via Proposals</FormLabel>
      <span className="text-2 text-neutral-11">
        When enabled, tokens are automatically minted to the treasury each time
        a proposal is approved. Disable this if you prefer to manage a pre-set
        budget by minting tokens to the treasury manually in advance.
      </span>
      <EnableProposalAutoMintingField />
      {!enableProposalAutoMinting && (
        <span className="text-2 text-neutral-11">
          Auto-minting is disabled. Tokens must now be issued through a separate
          minting proposal, which can be accessed in the settings.
        </span>
      )}
    </div>
  );
};
