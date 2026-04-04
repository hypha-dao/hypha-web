'use client';

import { Person, Space, useSpaceBySlug } from '@hypha-platform/core/client';
import { FormLabel } from '@hypha-platform/ui';
import { TransferableField } from './transferable-field';
import { EnableAdvancedTransferControlsField } from './enable-advanced-transfer-controls-field';
import { TransferWhitelistFieldArray } from './transfer-whitelist-field-array';
import { useTranslations } from 'next-intl';

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
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.transfer.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.transfer.description')}
      </span>
      <TransferableField />
      {transferable && (
        <>
          <span className="text-2 text-neutral-11">
            {tAgreementFlow(
              'plugins.issueNewToken.transfer.advancedControlsDescription',
            )}
          </span>
          <EnableAdvancedTransferControlsField />
          {enableAdvancedTransferControls && (
            <>
              {spaceName ? (
                <span className="text-2 text-neutral-11">
                  {tAgreementFlow(
                    'plugins.issueNewToken.transfer.autoWhitelistedNotice',
                    {
                      spaceName,
                    },
                  )}
                </span>
              ) : null}
              <TransferWhitelistFieldArray
                name="transferWhitelist.to"
                label={tAgreementFlow(
                  'plugins.issueNewToken.transfer.toWhitelistLabel',
                )}
                description={tAgreementFlow(
                  'plugins.issueNewToken.transfer.toWhitelistDescription',
                )}
                members={members}
                spaces={spaces}
              />
              {!isOwnershipToken && (
                <TransferWhitelistFieldArray
                  name="transferWhitelist.from"
                  label={tAgreementFlow(
                    'plugins.issueNewToken.transfer.fromWhitelistLabel',
                  )}
                  description={tAgreementFlow(
                    'plugins.issueNewToken.transfer.fromWhitelistDescription',
                  )}
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
