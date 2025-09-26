'use client';

import { Person, TOKENS, Token } from '@hypha-platform/core/client';
import { MemberWithNumberFieldFieldArray } from '../components/common/member-with-number-field-array';
import { TokenSelectorField } from '../components/common/token-selector-field';
import { useTokens } from '@hypha-platform/epics';
import { QuorumAndUnityChangerField } from '../components/common/quorum-and-unity-change-field';
import { useFormContext, useWatch } from 'react-hook-form';
import { Skeleton, Separator, Label } from '@hypha-platform/ui';
import { VotingMethodSelector } from '../../components/voting-method-selector';
import { VotingMethodType } from '@hypha-platform/core/client';
import React from 'react';

export const ChangeVotingMethodPlugin = ({
  spaceSlug,
  members,
  web3SpaceId,
}: {
  web3SpaceId?: number | null;
  spaceSlug: string;
  members: Person[];
}) => {
  const { tokens: rawTokens, isLoading } = useTokens({ spaceSlug }) as {
    tokens: Token[];
    isLoading: boolean;
  };

  const HYPHA_ADDRESS =
    TOKENS.find((t) => t.symbol === 'HYPHA')?.address.toLowerCase() || '';

  const filteredTokensFor1t1v = React.useMemo(() => {
    return rawTokens.filter((token) => {
      if (token.type === 'voice') return false;
      const isInTokensList = TOKENS.some(
        (t) => t.address.toLowerCase() === token.address.toLowerCase(),
      );
      const isHypha = token.address.toLowerCase() === HYPHA_ADDRESS;
      return !isInTokensList || isHypha;
    });
  }, [rawTokens, HYPHA_ADDRESS]);

  const filteredTokensFor1v1v = React.useMemo(() => {
    return rawTokens.filter((token) => token.type === 'voice');
  }, [rawTokens]);

  const { setValue, control } = useFormContext();

  const votingMethod = useWatch({
    control,
    name: 'votingMethod',
  });

  const handleMethodChange = (method: VotingMethodType | null) => {
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <Label>Voting Method</Label>
        <span className="text-2 text-neutral-11">
          Select a voting method template to apply default Quorum (min.
          participation) and Unity (min. alignment) values.
        </span>
        <QuorumAndUnityChangerField name="quorumAndUnity" />
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton loading={isLoading} width={'100%'} height={280}>
          <Label>Voting Power</Label>
          <VotingMethodSelector
            value={votingMethod}
            onChange={handleMethodChange}
            web3SpaceId={web3SpaceId}
            hasVotingTokens={filteredTokensFor1t1v.length > 0}
          />
        </Skeleton>
      </div>
      <div className="flex flex-col gap-5">
        {votingMethod === '1v1v' && (
          <>
            <Label>Voting Rules</Label>
            <TokenSelectorField name="token" tokens={filteredTokensFor1v1v} />
            <MemberWithNumberFieldFieldArray name="members" members={members} />
          </>
        )}
        {votingMethod === '1t1v' && (
          <Skeleton loading={isLoading} width={'100%'} height={24}>
            <Label>Voting Rules</Label>
            <TokenSelectorField name="token" tokens={filteredTokensFor1t1v} />
            <MemberWithNumberFieldFieldArray name="members" members={members} />
          </Skeleton>
        )}
      </div>
    </div>
  );
};
