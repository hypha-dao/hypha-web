'use client';

import { CreateSignalForm, CreateSignalFormProps } from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedCreateSignalForm(props: CreateSignalFormProps) {
  return <CreateSignalForm {...props} useMembers={useMembers} />;
}
