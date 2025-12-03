'use client';

import { Separator } from '@hypha-platform/ui';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Person, Space } from '@hypha-platform/core/client';
import {
  GeneralTokenSettings,
  AdvancedSettingsToggle,
  DecaySettingsToggle,
  AdvancedTokenSettings,
} from '../../components';

type IssueNewTokenPluginProps = {
  members?: Person[];
  spaces?: Space[];
  spaceSlug?: string;
};

export const IssueNewTokenPlugin = ({
  members = [],
  spaces = [],
  spaceSlug,
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
    setValue('transferable', true, {
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
  ]);

  useEffect(() => {
    const defaults = {
      enableProposalAutoMinting: true,
      transferable: true,
      enableTokenPrice: false,
    };

    Object.entries(defaults).forEach(([key, value]) => {
      if (getValues(key) === undefined) {
        setValue(key, value);
      }
    });
  }, [getValues, setValue]);

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

  return (
    <div className="flex flex-col gap-4">
      <GeneralTokenSettings tokenType={tokenType} setTokenType={setTokenType} />
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
    </div>
  );
};
