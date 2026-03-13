'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Separator,
  Switch,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type Person, type Space } from '@hypha-platform/core/client';
import {
  GeneralTokenSettings,
  AdvancedSettingsToggle,
  DecaySettingsToggle,
  AdvancedTokenSettings,
  SelectTokenField,
  DecaySettingsField,
} from '../../components';
import { useDbTokens } from '../../../hooks';

type UpdateIssuedTokenPluginProps = {
  members?: Person[];
  spaces?: Space[];
  spaceSlug?: string;
  spaceId?: number;
};

export const UpdateIssuedTokenPlugin = ({
  members = [],
  spaces = [],
  spaceSlug,
  spaceId,
}: UpdateIssuedTokenPluginProps) => {
  const { control, getValues, setValue, watch } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type'] || '');
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<
    string | null
  >(values['tokenAddress'] || null);

  const enableLimitedSupply = watch('enableLimitedSupply') ?? false;
  const setEnableLimitedSupply = (value: boolean) => {
    setValue('enableLimitedSupply', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const enableProposalAutoMinting = watch('enableProposalAutoMinting');
  const transferable = watch('transferable');
  const enableAdvancedTransferControls = watch(
    'enableAdvancedTransferControls',
  );
  const enableTokenPrice = watch('enableTokenPrice');
  const currentTokenType = watch('type');
  const tokenName = watch('name');
  const tokenSymbol = watch('symbol');
  const tokenIconUrl = watch('iconUrl');

  const areGeneralFieldsFilled =
    currentTokenType &&
    tokenName?.trim()?.length >= 2 &&
    tokenSymbol?.trim()?.length >= 2 &&
    (tokenIconUrl instanceof File ||
      (typeof tokenIconUrl === 'string' && tokenIconUrl.trim().length > 0));

  const clearLimitedSupplyFields = useCallback(() => {
    setValue('maxSupply', 0, { shouldDirty: true, shouldValidate: false });
    setValue('maxSupplyType', undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [setValue]);

  const clearTransferFields = useCallback(() => {
    setValue('enableAdvancedTransferControls', false, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('transferWhitelist', undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [setValue]);

  const clearTokenPriceFields = useCallback(() => {
    setValue('referenceCurrency', undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('tokenPrice', undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [setValue]);

  const clearAdvancedSettingsFields = useCallback(() => {
    clearLimitedSupplyFields();
    setValue('enableProposalAutoMinting', true, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('transferable', currentTokenType !== 'voice', {
      shouldDirty: true,
      shouldValidate: false,
    });
    clearTransferFields();
    setValue('enableTokenPrice', false, {
      shouldDirty: true,
      shouldValidate: false,
    });
    clearTokenPriceFields();
    setEnableLimitedSupply(false);
  }, [
    setValue,
    clearLimitedSupplyFields,
    clearTransferFields,
    clearTokenPriceFields,
    currentTokenType,
  ]);

  useEffect(() => {
    const currentType = currentTokenType;
    const defaults = {
      enableProposalAutoMinting: true,
      transferable: currentType !== 'voice',
      enableTokenPrice: false,
    };

    Object.entries(defaults).forEach(([key, value]) => {
      if (getValues(key) === undefined) {
        setValue(key, value);
      }
    });
  }, [getValues, setValue, currentTokenType]);

  const prevTokenTypeRef = useRef<string | undefined>(currentTokenType);
  useEffect(() => {
    const prevType = prevTokenTypeRef.current;
    const currentType = currentTokenType;

    if (
      prevType !== undefined &&
      prevType !== currentType &&
      currentType !== undefined
    ) {
      clearAdvancedSettingsFields();
      setValue('maxSupply', 0, { shouldDirty: true, shouldValidate: false });
      setValue(
        'decaySettings',
        {
          decayInterval: 2592000,
          decayPercentage: 1,
        },
        { shouldDirty: true, shouldValidate: false },
      );
      setValue('isVotingToken', currentType === 'voice', {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('transferable', currentType !== 'voice', {
        shouldDirty: true,
        shouldValidate: false,
      });
      setShowAdvancedSettings(false);
    }

    if (currentTokenType !== tokenType) {
      setTokenType(currentTokenType || '');
    }

    prevTokenTypeRef.current = currentType;
  }, [currentTokenType, tokenType, setValue, clearAdvancedSettingsFields]);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

  useEffect(() => {
    if (!areGeneralFieldsFilled && showAdvancedSettings) {
      setShowAdvancedSettings(false);
      clearAdvancedSettingsFields();
    }
  }, [
    areGeneralFieldsFilled,
    showAdvancedSettings,
    clearAdvancedSettingsFields,
  ]);

  useEffect(() => {
    if (!areGeneralFieldsFilled && showDecaySettings) {
      setShowDecaySettings(false);
    }
  }, [areGeneralFieldsFilled, showDecaySettings]);

  useEffect(() => {
    if (!showAdvancedSettings) {
      clearAdvancedSettingsFields();
    }
  }, [showAdvancedSettings, clearAdvancedSettingsFields]);

  useEffect(() => {
    if (!enableLimitedSupply) {
      clearLimitedSupplyFields();
    }
  }, [enableLimitedSupply, clearLimitedSupplyFields]);

  useEffect(() => {
    if (transferable === false) {
      clearTransferFields();
    }
  }, [transferable, clearTransferFields]);

  useEffect(() => {
    if (!enableAdvancedTransferControls) {
      setValue('transferWhitelist', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [enableAdvancedTransferControls, setValue]);

  useEffect(() => {
    if (!enableTokenPrice) {
      clearTokenPriceFields();
    }
  }, [enableTokenPrice, clearTokenPriceFields]);

  useEffect(() => {
    if (currentTokenType === 'ownership') {
      const whitelist = getValues('transferWhitelist');
      if (whitelist?.from) {
        setValue('transferWhitelist.from', undefined, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [currentTokenType, getValues, setValue]);

  useEffect(() => {
    if (transferable && enableAdvancedTransferControls) {
      const whitelist = getValues('transferWhitelist');
      const isOwnershipToken = currentTokenType === 'ownership';

      if (!whitelist) {
        setValue(
          'transferWhitelist',
          {},
          {
            shouldDirty: true,
            shouldValidate: false,
          },
        );
      }

      const currentWhitelist = getValues('transferWhitelist');
      if (currentWhitelist?.to === undefined) {
        setValue('transferWhitelist.to', [], {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
      if (!isOwnershipToken && currentWhitelist?.from === undefined) {
        setValue('transferWhitelist.from', [], {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [
    enableAdvancedTransferControls,
    getValues,
    setValue,
    transferable,
    currentTokenType,
  ]);

  // Fetch tokens for the space
  const { tokens: dbTokens, isLoading: tokensLoading } = useDbTokens();
  const spaceTokens = useMemo(() => {
    return dbTokens.filter((t) => t.spaceId === spaceId);
  }, [dbTokens, spaceSlug]);

  // Handle token selection
  const handleTokenSelect = (tokenAddress: string) => {
    setSelectedTokenAddress(tokenAddress);
    const token = spaceTokens.find((t) => t.address === tokenAddress);
    if (token) {
      setValue('tokenAddress', token.address);
      setValue('name', token.name);
      setValue('symbol', token.symbol);
      setValue('iconUrl', token.iconUrl || '');
      setValue('type', token.type);
      setValue('maxSupply', token.maxSupply);
      setValue('transferable', token.transferable);
      setValue('isVotingToken', token.isVotingToken);
      setValue('decaySettings', {
        decayInterval: token.decayInterval || 2592000,
        decayPercentage: token.decayPercentage || 1,
      });
      setTokenType(token.type);
    }
  };

  // Compute token supply and issuance to date (placeholder)
  const tokenSupply = selectedTokenAddress
    ? spaceTokens.find((t) => t.address === selectedTokenAddress)?.maxSupply ??
      0
    : 0;
  const issuanceToDate = 0; // TODO: fetch actual issuance from API

  return (
    <div className="flex flex-col gap-4">
      <SelectTokenField
        label="Token"
        name="tokenAddress"
        onValueChange={handleTokenSelect}
        tokens={spaceTokens}
        required
      />

      {spaceTokens.length === 0 && (
        <div className="text-2 text-neutral-11">
          Your space has not yet created a token,{' '}
          <a
            href={`/en/dho/${spaceSlug}/agreements/create/issue-new-token`}
            className="text-accent-11 underline"
          >
            click here
          </a>{' '}
          to first issue a token.
        </div>
      )}

      {selectedTokenAddress && (
        <>
          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <FormLabel className="text-2 text-neutral-11">
              Token Supply
            </FormLabel>
            <div className="text-2 text-neutral-11">
              {tokenSupply === 0
                ? 'Unlimited Supply'
                : tokenSupply.toLocaleString()}
            </div>
            <FormLabel className="text-2 text-neutral-11">
              Issuance to Date
            </FormLabel>
            <div className="text-2 text-neutral-11">
              {issuanceToDate.toLocaleString()}
            </div>
          </div>

          <Separator />

          {/* General token settings (editable) */}
          <GeneralTokenSettings
            tokenType={tokenType}
            setTokenType={setTokenType}
            showChooseType={false}
          />

          {areGeneralFieldsFilled && (
            <>
              <Separator />
              <AdvancedSettingsToggle
                showAdvancedSettings={showAdvancedSettings}
                setShowAdvancedSettings={setShowAdvancedSettings}
              />
            </>
          )}
          {showAdvancedSettings && areGeneralFieldsFilled && (
            <AdvancedTokenSettings
              enableLimitedSupply={enableLimitedSupply}
              setEnableLimitedSupply={setEnableLimitedSupply}
              enableProposalAutoMinting={enableProposalAutoMinting}
              transferable={transferable}
              enableAdvancedTransferControls={enableAdvancedTransferControls}
              enableTokenPrice={enableTokenPrice}
              members={members}
              spaces={spaces}
              tokenType={currentTokenType}
              spaceSlug={spaceSlug}
            />
          )}
          {tokenType === 'voice' && areGeneralFieldsFilled && (
            <>
              <Separator />
              <DecaySettingsToggle
                showDecaySettings={showDecaySettings}
                setShowDecaySettings={setShowDecaySettings}
              />
              {showDecaySettings && <DecaySettingsField name="decaySettings" />}
            </>
          )}

          {/* Archive Token toggle */}
          <Separator />
          <FormField
            control={control}
            name="archiveToken"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg p-3">
                <div className="space-y-0.5">
                  <FormLabel>Archive Token</FormLabel>
                  <div className="text-2 text-neutral-11">
                    Archiving a token will disable its use in new proposals and
                    transfers.
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
};
