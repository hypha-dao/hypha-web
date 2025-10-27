'use client';

import {
  Person,
  TOKENS,
  Token,
  useSpaceMinProposalDuration,
  VotingMethodType,
} from '@hypha-platform/core/client';
import { MemberWithNumberFieldFieldArray } from '../components/common/member-with-number-field-array';
import { TokenSelectorField } from '../components/common/token-selector-field';
import { useTokens } from '@hypha-platform/epics';
import { QuorumAndUnityChangerField } from '../components/common/quorum-and-unity-change-field';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Skeleton,
  Label,
  Switch,
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  RequirementMark,
  Separator,
} from '@hypha-platform/ui';
import { VotingMethodSelector } from '../../components/voting-method-selector';
import React from 'react';

const votingDurationOptions = [
  { label: '6 hours', value: 6 * 3600 },
  { label: '12 hours', value: 12 * 3600 },
  { label: '24 hours', value: 24 * 3600 },
  { label: '2 days', value: 2 * 86400 },
  { label: '3 days', value: 3 * 86400 },
  { label: '5 days', value: 5 * 86400 },
  { label: '7 days', value: 7 * 86400 },
  { label: '10 days', value: 10 * 86400 },
  { label: '14 days', value: 14 * 86400 },
  { label: '21 days', value: 21 * 86400 },
  { label: '30 days', value: 30 * 86400 },
];

export const ChangeVotingMethodPlugin = ({
  spaceSlug,
  members,
  web3SpaceId,
}: {
  web3SpaceId?: number | null;
  spaceSlug: string;
  members: Person[];
}) => {
  const { duration } = useSpaceMinProposalDuration({
    spaceId: BigInt(web3SpaceId as number),
  });

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

  const { control, setValue, getValues } = useFormContext();

  const quorumAndUnity = useWatch({
    control,
    name: 'quorumAndUnity',
  });

  const votingMethod = useWatch({
    control,
    name: 'votingMethod',
  });

  const autoExecution = useWatch({
    control,
    name: 'autoExecution',
  });

  const votingDuration = useWatch({
    control,
    name: 'votingDuration',
  });

  const isQuorumTooLow = (quorumAndUnity?.quorum ?? 0) < 20;

  React.useEffect(() => {
    if (duration !== undefined && votingDuration === undefined) {
      setValue('votingDuration', duration);
    }
  }, [duration, votingDuration, setValue]);

  React.useEffect(() => {
    const currentQuorum = quorumAndUnity?.quorum ?? 0;
    const currentAutoExecution = getValues('autoExecution');
    const currentVotingDuration = getValues('votingDuration');

    if (currentQuorum < 20) {
      if (currentAutoExecution !== false) {
        setValue('autoExecution', false);
      }
      if (currentVotingDuration === undefined && duration !== undefined) {
        setValue('votingDuration', duration);
      }
    } else {
      if (currentAutoExecution !== true) {
        setValue('autoExecution', true);
      }
      if (currentVotingDuration !== 0) {
        setValue('votingDuration', 0);
      }
    }
  }, [quorumAndUnity?.quorum, duration, setValue, getValues]);

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

  const handleAutoExecutionChange = (val: boolean) => {
    setValue('autoExecution', val);

    if (val) {
      setValue('votingDuration', 0);
    } else {
      if (duration !== undefined) {
        setValue('votingDuration', duration);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5">
        <Label>Voting Method</Label>
        <span className="text-2 text-neutral-11">
          Select a voting method template, or adjust Quorum and Unity values
          with the sliders.
        </span>
        <QuorumAndUnityChangerField name="quorumAndUnity" />
      </div>

      <Separator />

      <div className="flex flex-col gap-5">
        <Label>Voting Period</Label>

        <FormField
          control={control}
          name="autoExecution"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex w-full justify-between items-center text-2 text-neutral-11">
                  <span>Auto-execution (when conditions are met)</span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={handleAutoExecutionChange}
                    className="ml-2"
                    disabled={isQuorumTooLow}
                  />
                </div>
              </FormControl>
              <FormMessage />
              {isQuorumTooLow && (
                <span className="text-2 text-neutral-11">
                  Auto-execution is disabled when quorum is below 20% to protect
                  treasury assets.
                </span>
              )}
            </FormItem>
          )}
        />

        {!autoExecution && (
          <>
            <FormField
              control={control}
              name="votingDuration"
              render={({ field }) => (
                <FormItem>
                  <span className="flex justify-between w-full">
                    <Label className="w-full flex items-center">
                      Minimum Voting Duration
                      <RequirementMark className="text-2 ml-1" />
                    </Label>
                    <FormControl>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {votingDurationOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </span>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
      <Separator />
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
            <Label>Voting Token Allocation</Label>
            <TokenSelectorField
              showRequirementMark={true}
              name="token"
              tokens={filteredTokensFor1v1v}
            />
            <MemberWithNumberFieldFieldArray name="members" members={members} />
          </>
        )}

        {votingMethod === '1t1v' && (
          <Skeleton loading={isLoading} width={'100%'} height={24}>
            <Label>Voting Token Allocation</Label>
            <TokenSelectorField
              showRequirementMark={true}
              name="token"
              tokens={filteredTokensFor1t1v}
            />
            <MemberWithNumberFieldFieldArray name="members" members={members} />
          </Skeleton>
        )}
      </div>
    </div>
  );
};
