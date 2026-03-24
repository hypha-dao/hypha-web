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
import { useTokens, useAssets } from '@hypha-platform/epics';
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
import { useTranslations } from 'next-intl';

const votingDurationOptions = [
  { labelKey: 'h6', value: 6 * 3600 },
  { labelKey: 'h12', value: 12 * 3600 },
  { labelKey: 'h24', value: 24 * 3600 },
  { labelKey: 'd2', value: 2 * 86400 },
  { labelKey: 'd3', value: 3 * 86400 },
  { labelKey: 'd5', value: 5 * 86400 },
  { labelKey: 'd7', value: 7 * 86400 },
  { labelKey: 'd10', value: 10 * 86400 },
  { labelKey: 'd14', value: 14 * 86400 },
  { labelKey: 'd21', value: 21 * 86400 },
  { labelKey: 'd30', value: 30 * 86400 },
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
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { duration } = useSpaceMinProposalDuration({
    spaceId: BigInt(web3SpaceId as number),
  });

  const { tokens: rawTokens, isLoading } = useTokens({ spaceSlug }) as {
    tokens: Token[];
    isLoading: boolean;
  };

  const { assets } = useAssets({ filter: { type: 'all' } });

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
        <Label>{tAgreementFlow('plugins.quorumAndUnity.title')}</Label>
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.quorumAndUnity.description')}
        </span>
        <QuorumAndUnityChangerField name="quorumAndUnity" />
      </div>

      <Separator />

      <div className="flex flex-col gap-5">
        <Label>{tAgreementFlow('plugins.quorumAndUnity.votingPeriod')}</Label>

        <FormField
          control={control}
          name="autoExecution"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex w-full justify-between items-center text-2 text-neutral-11">
                  <span>
                    {tAgreementFlow(
                      'plugins.quorumAndUnity.autoExecutionWhenConditionsMet',
                    )}
                  </span>
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
                  {tAgreementFlow(
                    'plugins.quorumAndUnity.autoExecutionDisabled',
                  )}
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
                      {tAgreementFlow(
                        'plugins.quorumAndUnity.minimumVotingDuration',
                      )}
                      <RequirementMark className="text-2 ml-1" />
                    </Label>
                    <FormControl>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={tAgreementFlow(
                              'plugins.quorumAndUnity.durationPlaceholder',
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {votingDurationOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              {tAgreementFlow(
                                `plugins.quorumAndUnity.durations.${opt.labelKey}`,
                              )}
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
          <Label>{tAgreementFlow('plugins.quorumAndUnity.votingPower')}</Label>
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
            <Label>
              {tAgreementFlow('plugins.quorumAndUnity.votingTokenAllocation')}
            </Label>
            <TokenSelectorField
              showRequirementMark={true}
              name="token"
              tokens={filteredTokensFor1v1v}
            />
            <MemberWithNumberFieldFieldArray
              name="members"
              members={members}
              assets={assets}
            />
          </>
        )}

        {votingMethod === '1t1v' && (
          <Skeleton loading={isLoading} width={'100%'} height={24}>
            <Label>
              {tAgreementFlow('plugins.quorumAndUnity.votingTokenAllocation')}
            </Label>
            <TokenSelectorField
              showRequirementMark={true}
              name="token"
              tokens={filteredTokensFor1t1v}
            />
            <MemberWithNumberFieldFieldArray
              name="members"
              members={members}
              assets={assets}
            />
          </Skeleton>
        )}
      </div>
    </div>
  );
};
