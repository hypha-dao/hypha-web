'use client';

import { Person } from '@core/people';
import { MemberWithNumberFieldFieldArray } from '../components/common/member-with-number-field-array';
import { TokenSelectorField } from '../components/common/token-selector-field';
import { useTokens } from '@hypha-platform/epics';
import { QuorumAndUnityChangerField } from '../components/common/quorum-and-unity-change-field';
import { useFormContext, useWatch } from 'react-hook-form';
import { Skeleton } from '@hypha-platform/ui';
import {
  VotingMethodSelector,
  VotingMethodId,
} from '../../components/voting-method-selector';

export const ChangeVotingMethodPlugin = ({
  spaceSlug,
  members,
}: {
  spaceSlug: string;
  members: Person[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const { setValue, control } = useFormContext();

  const votingMethod = useWatch({
    control,
    name: 'votingMethod',
  });

  const handleMethodChange = (method: VotingMethodId | null) => {
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
      <VotingMethodSelector
        value={votingMethod}
        onChange={handleMethodChange}
      />
      {votingMethod === '1v1v' && (
        <>
          <MemberWithNumberFieldFieldArray name="members" members={members} />
        </>
      )}
      {votingMethod === '1t1v' && (
        <Skeleton loading={isLoading} width={'100%'} height={24}>
          <TokenSelectorField name="token" tokens={tokens} />
        </Skeleton>
      )}
      <QuorumAndUnityChangerField name="quorumAndUnity" />
    </div>
  );
};
