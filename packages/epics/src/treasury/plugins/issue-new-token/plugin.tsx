'use client';

import { Separator } from '@hypha-platform/ui';
import {
  TokenNameField,
  TokenSymbolField,
  TokenIconField,
  // TokenDescriptionField,
  // TokenDigitsField,
  TokenTypeField,
  TokenMaxSupplyField,
} from '../../components';
import { IsVotingTokenField } from '../../components/common/is-voting-token-field';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect } from 'react';

export const IssueNewTokenPlugin = () => {
  const { getValues, setValue } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
      {/* <TokenDescriptionField /> */}
      {/* <TokenDigitsField /> */}
      <TokenTypeField
        onValueChange={(value: string) => {
          setTokenType(value);
        }}
      />
      <TokenMaxSupplyField />
      {tokenType === 'voice' && (
        <>
          <Separator />
          <DecaySettingsField name="decaySettings" />
        </>
      )}
      {tokenType !== 'voice' && <IsVotingTokenField />}
    </div>
  );
};
