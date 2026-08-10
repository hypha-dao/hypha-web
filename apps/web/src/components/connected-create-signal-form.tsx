'use client';

import { CreateSignalForm, CreateSignalFormProps } from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedCreateSignalForm(
  props: Omit<CreateSignalFormProps, 'useMembers'>,
) {
  return <CreateSignalForm {...props} useMembers={useMembers} />;
}
