'use client';

import { FormLabel, Separator, Switch } from '@hypha-platform/ui';
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
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>General</FormLabel>
      <span className="text-2 text-neutral-11">
        {' '}
        Select your token type and customize its name, symbol, and icon for
        clear identification.
      </span>
      <TokenTypeField
        onValueChange={(value: string) => {
          setTokenType(value);
        }}
      />
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
      {/* <TokenDescriptionField /> */}
      {/* <TokenDigitsField /> */}
      {/* <TokenMaxSupplyField /> */}
      {tokenType === 'voice' && (
        <>
          <div className="flex items-center gap-3 justify-between">
            <label
              htmlFor="decay-settings-toggle"
              className="text-2 text-neutral-11 font-medium"
            >
              Advanced Decay Settings
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
