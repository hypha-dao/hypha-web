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
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext } from 'react-hook-form';
import { useState } from 'react';

export const IssueNewTokenPlugin = () => {
  const { getValues } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);

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
    </div>
  );
};
