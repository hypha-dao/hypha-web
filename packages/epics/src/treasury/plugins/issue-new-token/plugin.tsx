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
  ownershipToWhitelistMembers?: Person[];
  ownershipToWhitelistSpaces?: Space[];
};

export const IssueNewTokenPlugin = ({
  members = [],
  spaces = [],
  spaceSlug,
  ownershipToWhitelistMembers,
  ownershipToWhitelistSpaces,
}: IssueNewTokenPluginProps) => {
  const {
    getValues,
    setValue,
    watch,
    formState: { dirtyFields },
  } = useFormContext();
  const values = getValues();
  const [tokenType, setTokenType] = useState<string>(values['type']);
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  /**
   * Voice only: auto-open Advanced Decay once when decay first becomes dirty.
   * Collapsing the panel does not clear `decaySettings` — values stay in the form.
   */
  const prevVoiceDecayDirtyRef = useRef(false);

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
      prevVoiceDecayDirtyRef.current = false;
      setShowDecaySettings(false);
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
    if (currentTokenType !== 'voice') {
      prevVoiceDecayDirtyRef.current = false;
      return;
    }
    const ds = dirtyFields.decaySettings;
    const decayDirty =
      typeof ds === 'object' &&
      ds !== null &&
      Object.keys(ds as object).length > 0;
    if (decayDirty && !prevVoiceDecayDirtyRef.current) {
      setShowDecaySettings(true);
    }
    prevVoiceDecayDirtyRef.current = decayDirty;
  }, [currentTokenType, dirtyFields.decaySettings]);

  useEffect(() => {
    if (!showAdvancedSettings) {
      clearAdvancedSettingsFields();
    }
  }, [showAdvancedSettings, clearAdvancedSettingsFields]);

  const prevEnableLimitedSupplyRef = useRef(enableLimitedSupply);
  useEffect(() => {
    if (
      prevEnableLimitedSupplyRef.current === true &&
      enableLimitedSupply === false
    ) {
      clearLimitedSupplyFields();
    }
    prevEnableLimitedSupplyRef.current = enableLimitedSupply;
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
          ownershipToWhitelistMembers={ownershipToWhitelistMembers}
          ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
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
