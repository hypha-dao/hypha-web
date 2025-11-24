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
  TokenMaxSupplyTypeField,
} from '../../components';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext, Controller } from 'react-hook-form';
import { useState, useEffect } from 'react';

export const IssueNewTokenPlugin = () => {
  const { getValues, setValue, watch } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [enableLimitedSupply, setEnableLimitedSupply] =
    useState<boolean>(false);

  const enableProposalAutoMinting = watch('enableProposalAutoMinting');

  useEffect(() => {
    if (getValues('enableProposalAutoMinting') === undefined) {
      setValue('enableProposalAutoMinting', true);
    }
  }, [getValues, setValue]);

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
      <Separator />
      <div className="flex flex-col gap-4">
        <FormLabel>Advanced Token Settings</FormLabel>
        <span className="text-2 text-neutral-11">
          Activate advanced settings to access detailed controls for token
          supply, minting permissions, burn rules, transfer policies, and
          initial token pricing.
        </span>
        <div className="flex w-full justify-between items-center text-2 text-neutral-11">
          <span>Enable Token Advanced Settings</span>
          <Switch
            checked={showAdvancedSettings}
            onCheckedChange={setShowAdvancedSettings}
            className="ml-2"
          />
        </div>
        {showAdvancedSettings && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              <FormLabel>Token Supply</FormLabel>
              <span className="text-2 text-neutral-11">
                Choose a fixed or unlimited token supply. Select “Limited
                Supply” to set a maximum token amount, either permanently or
                with an option to update in the future.
              </span>
              <div className="flex w-full justify-between items-center text-2 text-neutral-11">
                <span>Enable Limited Supply</span>
                <Switch
                  checked={enableLimitedSupply}
                  onCheckedChange={setEnableLimitedSupply}
                  className="ml-2"
                />
              </div>
              {enableLimitedSupply && (
                <>
                  <TokenMaxSupplyField />
                  <TokenMaxSupplyTypeField />
                </>
              )}
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <FormLabel>Auto-Mint Tokens via Proposals</FormLabel>
              <span className="text-2 text-neutral-11">
                When enabled, tokens are automatically minted to the treasury
                each time a proposal is approved. Disable this if you prefer to
                manage a pre-set budget by minting tokens to the treasury
                manually in advance.
              </span>
              <div className="flex w-full justify-between items-center text-2 text-neutral-11">
                <span>Enable Proposal Auto-Minting</span>
                <Controller
                  name="enableProposalAutoMinting"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="ml-2"
                    />
                  )}
                />
              </div>
              {!enableProposalAutoMinting && (
                <span className="text-2 text-neutral-11">
                  Auto-minting is disabled. Tokens must now be issued through a
                  separate minting proposal, which can be accessed in the
                  settings.
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {/* <TokenDescriptionField /> */}
      {/* <TokenDigitsField /> */}
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
