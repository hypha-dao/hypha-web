'use client';

import {
  FormLabel,
  Separator,
  Switch,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import {
  TokenNameField,
  TokenSymbolField,
  TokenIconField,
  // TokenDescriptionField,
  // TokenDigitsField,
  TokenTypeField,
  TokenMaxSupplyField,
  TokenMaxSupplyTypeField,
  TransferWhitelistFieldArray,
} from '../../components';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext, Controller } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Person, Space } from '@hypha-platform/core/client';

type IssueNewTokenPluginProps = {
  members?: Person[];
  spaces?: Space[];
};

export const IssueNewTokenPlugin = ({
  members = [],
  spaces = [],
}: IssueNewTokenPluginProps) => {
  const { getValues, setValue, watch } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [enableLimitedSupply, setEnableLimitedSupply] =
    useState<boolean>(false);

  const enableProposalAutoMinting = watch('enableProposalAutoMinting');
  const transferable = watch('transferable');
  const enableAdvancedTransferControls = watch(
    'enableAdvancedTransferControls',
  );
  const enableTokenPrice = watch('enableTokenPrice');

  useEffect(() => {
    if (getValues('enableProposalAutoMinting') === undefined) {
      setValue('enableProposalAutoMinting', true);
    }
  }, [getValues, setValue]);

  useEffect(() => {
    if (getValues('transferable') === undefined) {
      setValue('transferable', true);
    }
  }, [getValues, setValue]);

  useEffect(() => {
    if (getValues('enableTokenPrice') === undefined) {
      setValue('enableTokenPrice', false);
    }
  }, [getValues, setValue]);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

  useEffect(() => {
    if (transferable === false) {
      setValue('enableAdvancedTransferControls', false);
    }
  }, [setValue, transferable]);

  useEffect(() => {
    if (!transferable || !enableAdvancedTransferControls) {
      setValue('transferWhitelist', undefined);
      return;
    }
    const whitelist = getValues('transferWhitelist');
    if (!whitelist?.to?.length) {
      setValue('transferWhitelist.to', [
        { type: 'member', address: '', includeSpaceMembers: true },
      ]);
    }
    if (!whitelist?.from?.length) {
      setValue('transferWhitelist.from', [
        { type: 'member', address: '', includeSpaceMembers: true },
      ]);
    }
  }, [enableAdvancedTransferControls, getValues, setValue, transferable]);

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
            <Separator />
            <div className="flex flex-col gap-4">
              <FormLabel>Token Transfer</FormLabel>
              <span className="text-2 text-neutral-11">
                Control who can send and receive your token. Make it freely
                transferable, limit transfers to whitelisted accounts or spaces,
                or fully restrict transfers for maximum oversight.
              </span>
              <div className="flex w-full items-center justify-between text-2 text-neutral-11">
                <span>Transferable</span>
                <Controller
                  name="transferable"
                  render={({ field }) => (
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      className="ml-2"
                    />
                  )}
                />
              </div>
              {transferable && (
                <>
                  <span className="text-2 text-neutral-11">
                    For more control, you can optionally enable whitelisting.
                    This restricts token transfers to only selected members,
                    spaces, or blockchain addresses that you specify. If you
                    don’t enable this option, tokens remain freely transferable
                    to all accounts.
                  </span>
                  <div className="flex w-full items-center justify-between text-2 text-neutral-11">
                    <span>Optional: Advanced Transfer Controls</span>
                    <Controller
                      name="enableAdvancedTransferControls"
                      render={({ field }) => (
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                          className="ml-2"
                        />
                      )}
                    />
                  </div>
                  {enableAdvancedTransferControls && (
                    <>
                      <span className="text-2 text-neutral-11">
                        Only listed members or spaces can send or receive tokens
                        when whitelisting is enabled.
                      </span>
                      <TransferWhitelistFieldArray
                        name="transferWhitelist.to"
                        label="“To” Whitelist"
                        description="Define who is allowed to receive tokens. Add members or spaces, include blockchain addresses, and choose if the whitelisting applies to an entire space or just its account."
                        members={members}
                        spaces={spaces}
                      />
                      <TransferWhitelistFieldArray
                        name="transferWhitelist.from"
                        label="“From” Whitelist"
                        description="Restrict which members or spaces are allowed to send tokens. Combine dropdown selections with custom blockchain addresses for complete coverage."
                        members={members}
                        spaces={spaces}
                      />
                    </>
                  )}
                </>
              )}
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <FormLabel>Token Value on Treasury</FormLabel>
              <span className="text-2 text-neutral-11">
                Set an initial value for your token. The reference price is
                displayed in your treasury and helps members understand the
                token’s starting market value.
              </span>
              <div className="flex w-full justify-between items-center text-2 text-neutral-11">
                <span>Enable Token Price</span>
                <Controller
                  name="enableTokenPrice"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="ml-2"
                    />
                  )}
                />
              </div>
              {enableTokenPrice && (
                <>
                  <div className="flex w-full justify-between">
                    <span className="text-2 text-neutral-11 w-full">
                      Reference Currency
                    </span>
                    <Controller
                      name="referenceCurrency"
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="flex w-full justify-between">
                    <span className="text-2 text-neutral-11 w-full">
                      Token Price
                    </span>
                    <Controller
                      name="tokenPrice"
                      render={({ field }) => (
                        <Input
                          type="number"
                          placeholder="Enter token price"
                          {...field}
                        />
                      )}
                    />
                  </div>
                </>
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
