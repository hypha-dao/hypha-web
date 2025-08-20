'use client';

import { Separator, Switch } from '@hypha-platform/ui';
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
import { useState, useEffect } from 'react';

export const IssueNewTokenPlugin = () => {
  const { getValues, setValue } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(true);

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
      {/* <TokenMaxSupplyField /> */}
      {tokenType === 'voice' && (
        <>
          <div className="flex items-center gap-3 justify-between">
            <label
              htmlFor="decay-settings-toggle"
              className="text-2 text-neutral-11 font-medium"
            >
              Enable Decay Settings
            </label>
            <Switch
              id="decay-settings-toggle"
              checked={showDecaySettings}
              onCheckedChange={setShowDecaySettings}
            />
          </div>
          {showDecaySettings && (
            <>
              <Separator />
              <DecaySettingsField name="decaySettings" />
            </>
          )}
        </>
      )}
    </div>
  );
};
