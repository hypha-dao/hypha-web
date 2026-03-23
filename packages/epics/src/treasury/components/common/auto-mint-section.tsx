'use client';

import { FormLabel } from '@hypha-platform/ui';
import { EnableProposalAutoMintingField } from './enable-proposal-auto-minting-field';
import { useTranslations } from 'next-intl';

export const AutoMintSection = ({
  enableProposalAutoMinting,
}: {
  enableProposalAutoMinting: boolean;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.autoMint.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.autoMint.description')}
      </span>
      <EnableProposalAutoMintingField />
      {!enableProposalAutoMinting && (
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.issueNewToken.autoMint.disabledNotice')}
        </span>
      )}
    </div>
  );
};
