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
  /** Web3 id of the issuing space; auto-included in the mutual credit whitelist. */
  currentSpaceWeb3Id?: number | null;
  ownershipToWhitelistMembers?: Person[];
  ownershipToWhitelistSpaces?: Space[];
  /** When set (e.g. after resubmit hydration), skip effects that clear advanced fields. */
  resubmitKey?: number;
};

export const IssueNewTokenPlugin = ({
  members = [],
  spaces = [],
  spaceSlug,
  currentSpaceWeb3Id,
  ownershipToWhitelistMembers,
  ownershipToWhitelistSpaces,
  resubmitKey,
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

  const resubmitHydrationRef = useRef(false);
  useEffect(() => {
    if (resubmitKey === undefined || resubmitKey <= 0) return;
    // `resubmitKey` bumps only after `useResubmitProposalData` finishes applying
    // resubmit payload (reset + setValue). The requestAnimationFrame window skips
    // clearing side-effects in the same paint so hydrated values are not wiped.
    resubmitHydrationRef.current = true;
    const id = requestAnimationFrame(() => {
      resubmitHydrationRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [resubmitKey]);

  const skipResubmitSideEffects = () => resubmitHydrationRef.current;

  /**
   * Mirror the spaces list into a hidden field so the orchestrator can resolve
   * space rows in `transferWhitelist.from/to` → web3 space ids and feed them
   * into the new factory `initial(Transfer|Receive)WhitelistSpaceIds` args.
   */
  useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    setValue('spacesForWhitelistResolution', spaces, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [spaces, setValue]);

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
  const enableMutualCredit = watch('enableMutualCredit') ?? false;
  const setEnableMutualCredit = (value: boolean) => {
    setValue('enableMutualCredit', value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const currentTokenType = watch('type');
  const tokenName = watch('name');
  const tokenSymbol = watch('symbol');
  const tokenIconUrl = watch('iconUrl');

  useEffect(() => {
    if (resubmitKey === undefined || resubmitKey <= 0) return;
    const lim = getValues('enableLimitedSupply');
    const adv = getValues('enableAdvancedTransferControls');
    const price = getValues('enableTokenPrice');
    const minters = getValues('authorizedMinters');
    if (lim || adv || price || (minters?.length ?? 0) > 0) {
      setShowAdvancedSettings(true);
    }
    if (currentTokenType === 'voice') {
      const ds = getValues('decaySettings');
      if (
        ds &&
        typeof ds === 'object' &&
        (ds as { decayInterval?: number }).decayInterval !== 2592000
      ) {
        setShowDecaySettings(true);
      }
    }
  }, [resubmitKey, getValues, currentTokenType]);

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

  const clearMutualCreditFields = useCallback(() => {
    setValue('enableMutualCredit', false, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('defaultCreditLimit', undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('creditWhitelistedSpaceIds', [], {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [setValue]);

  const clearAuthorizedMintersFields = useCallback(() => {
    setValue('authorizedMinters', [], {
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
    clearMutualCreditFields();
    clearAuthorizedMintersFields();
    setEnableLimitedSupply(false);
  }, [
    setValue,
    clearLimitedSupplyFields,
    clearTransferFields,
    clearTokenPriceFields,
    clearMutualCreditFields,
    clearAuthorizedMintersFields,
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
    if (skipResubmitSideEffects()) return;
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
    if (skipResubmitSideEffects()) return;
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
    if (skipResubmitSideEffects()) return;
    if (!showAdvancedSettings) {
      clearAdvancedSettingsFields();
    }
  }, [showAdvancedSettings, clearAdvancedSettingsFields]);

  const prevEnableLimitedSupplyRef = useRef(enableLimitedSupply);
  useEffect(() => {
    if (skipResubmitSideEffects()) return;
    if (
      prevEnableLimitedSupplyRef.current === true &&
      enableLimitedSupply === false
    ) {
      clearLimitedSupplyFields();
    }
    prevEnableLimitedSupplyRef.current = enableLimitedSupply;
  }, [enableLimitedSupply, clearLimitedSupplyFields]);

  useEffect(() => {
    if (skipResubmitSideEffects()) return;
    if (transferable === false) {
      clearTransferFields();
    }
  }, [transferable, clearTransferFields]);

  useEffect(() => {
    if (skipResubmitSideEffects()) return;
    if (!enableAdvancedTransferControls) {
      setValue('transferWhitelist', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [enableAdvancedTransferControls, setValue]);

  useEffect(() => {
    if (skipResubmitSideEffects()) return;
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
          enableMutualCredit={enableMutualCredit}
          setEnableMutualCredit={setEnableMutualCredit}
          members={members}
          spaces={spaces}
          ownershipToWhitelistMembers={ownershipToWhitelistMembers}
          ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
          tokenType={currentTokenType}
          spaceSlug={spaceSlug}
          currentSpaceWeb3Id={currentSpaceWeb3Id}
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
