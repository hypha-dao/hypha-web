import { Person, Space } from '@hypha-platform/core/client';
import { FormLabel } from '@hypha-platform/ui';
import { TransferableField } from './transferable-field';
import { EnableAdvancedTransferControlsField } from './enable-advanced-transfer-controls-field';
import { TransferWhitelistFieldArray } from './transfer-whitelist-field-array';

export const TransferSection = ({
  transferable,
  enableAdvancedTransferControls,
  members,
  spaces,
}: {
  transferable: boolean;
  enableAdvancedTransferControls: boolean;
  members: Person[];
  spaces: Space[];
}) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Token Transfer</FormLabel>
      <span className="text-2 text-neutral-11">
        Control who can send and receive your token. You can make it fully
        transferable, restrict transfers to whitelisted accounts or spaces, or
        disable transfers entirely for maximum control.
      </span>
      <TransferableField />
      {transferable && (
        <>
          <span className="text-2 text-neutral-11">
            For more control, you can optionally enable whitelisting. This
            restricts token transfers to only selected members, spaces, or
            blockchain addresses that you specify. If you don’t enable this
            option, tokens remain freely transferable to all accounts.
          </span>
          <EnableAdvancedTransferControlsField />
          {enableAdvancedTransferControls && (
            <>
              <span className="text-2 text-neutral-11">
                Only listed members or spaces can send or receive tokens when
                whitelisting is enabled.
              </span>
              <TransferWhitelistFieldArray
                name="transferWhitelist.to"
                label="“To” Whitelist"
                description="Define who is allowed to receive tokens. Add members or spaces, include blockchain addresses, and choose if the whitelisting applies to an entire space or just its account."
                members={members}
                spaces={spaces}
              />
              <TransferWhitelistFieldArray
                name="transferWhitelist.from"
                label="“From” Whitelist"
                description="Restrict which members or spaces are allowed to send tokens. Combine dropdown selections with custom blockchain addresses for complete coverage."
                members={members}
                spaces={spaces}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
