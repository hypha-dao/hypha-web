'use client';

import { Person, Space } from '@hypha-platform/core/client';
import { RecipientField } from '../components/common/recipient-field';
import { useTranslations } from 'next-intl';

export interface MembershipExitPluginProps {
  members: Person[];
  spaces?: Space[];
}

export const MembershipExitPlugin = ({
  members,
  spaces,
}: MembershipExitPluginProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        emptyMembersMessage={tAgreementFlow('plugins.membershipExit.noMembersFound')}
        emptySpacesMessage={tAgreementFlow(
          'plugins.membershipExit.noMemberSpacesFound',
        )}
        name="member"
        label={tAgreementFlow('plugins.membershipExit.exitingMember')}
      />
    </div>
  );
};
