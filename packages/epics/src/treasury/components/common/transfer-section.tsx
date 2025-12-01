import { Person, Space, useSpaceBySlug } from '@hypha-platform/core/client';
import { FormLabel } from '@hypha-platform/ui';
import { TransferableField } from './transferable-field';
import { EnableAdvancedTransferControlsField } from './enable-advanced-transfer-controls-field';
import { TransferWhitelistFieldArray } from './transfer-whitelist-field-array';

export const TransferSection = ({
  transferable,
  enableAdvancedTransferControls,
  members,
  spaces,
  tokenType,
  spaceSlug,
}: {
  transferable: boolean;
  enableAdvancedTransferControls: boolean;
  members: Person[];
  spaces: Space[];
  tokenType?: string;
  spaceSlug?: string;
}) => {
  const isOwnershipToken = tokenType === 'ownership';
  const { space } = useSpaceBySlug(spaceSlug || '');
  const spaceName = space?.title ?? '';

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
                {spaceName} and its members are automatically whitelisted.
                Listing space(s) and/or member(s) below allows them to send
                ("From" Whitelist) or receive ("To" Whitelist) tokens when
                whitelisting is enabled.
              </span>
              <TransferWhitelistFieldArray
                name="transferWhitelist.to"
                label="“To” Whitelist"
                description="Define which members or spaces are allowed to receive tokens. Add members or spaces, include blockchain addresses, and choose if the whitelisting applies to an entire space or just its treasury account."
                members={members}
                spaces={spaces}
              />
              {!isOwnershipToken && (
                <TransferWhitelistFieldArray
                  name="transferWhitelist.from"
                  label="“From” Whitelist"
                  description="Define which members or spaces are allowed to send tokens. Add members or spaces, include blockchain addresses, and choose if the whitelisting applies to an entire space or just its treasury account."
                  members={members}
                  spaces={spaces}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
