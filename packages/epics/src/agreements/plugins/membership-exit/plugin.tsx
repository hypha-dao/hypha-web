'use client';

import { Person, Space } from '@hypha-platform/core/client';
import { RecipientField } from '../components/common/recipient-field';

export interface MembershipExitPluginProps {
  members: Person[];
  spaces?: Space[];
}

export const MembershipExitPlugin = ({
  members,
  spaces,
}: MembershipExitPluginProps) => {
  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        name="member"
        label="Exiting Member"
      />
    </div>
  );
};
