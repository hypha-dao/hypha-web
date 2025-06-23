'use client';

import { useState } from 'react';
import {
  type VotingMethodId,
  VotingMethodSelector,
} from '../../components/voting-method-selector';
import { Person } from '@core/people';
import { MemberWithNumberFieldFieldArray } from '../components/common/member-with-number-field-array';
import { TokenSelectorField } from '../components/common/token-selector-field';
import { useTokens } from '@hypha-platform/epics';
import { QuorumAndUnityChangerField } from '../components/common/quorum-and-unity-change-field';
import { useFormContext } from 'react-hook-form';

export const ChangeVotingMethodPlugin = ({
  members,
}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const { tokens } = useTokens();
  const { setValue } = useFormContext();

  const handleMethodChange = (method: VotingMethodId | null) => {
    setSelectedMethod(method);
    setValue('votingMethod', method);
    setValue(
      'members',
      method === '1v1v'
        ? [
            {
              member: undefined,
              number: undefined,
            },
          ]
        : [],
    );
    setValue('token', undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      <VotingMethodSelector onChange={handleMethodChange} />
      {selectedMethod === '1v1v' && (
        <>
          <MemberWithNumberFieldFieldArray name="members" members={members} />
        </>
      )}
      {selectedMethod === '1t1v' && (
        <TokenSelectorField name="token" tokens={tokens} />
      )}
      <QuorumAndUnityChangerField name="quorumAndUnity" />
    </div>
  );
};
