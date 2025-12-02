'use client';

import { Separator } from '@hypha-platform/ui';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect, useRef } from 'react';
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

  const prevTokenTypeRef = useRef<string | undefined>(currentTokenType);
  useEffect(() => {
    const prevType = prevTokenTypeRef.current;
    const currentType = currentTokenType;

    if (
      prevType !== undefined &&
      prevType !== currentType &&
      currentType !== undefined
    ) {
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
      setValue('enableAdvancedTransferControls', false, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('transferWhitelist', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('enableProposalAutoMinting', true, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('maxSupplyType', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('enableTokenPrice', false, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('referenceCurrency', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setValue('tokenPrice', undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setShowAdvancedSettings(false);
      setEnableLimitedSupply(false);
    }

    if (currentTokenType !== tokenType) {
      setTokenType(currentTokenType || '');
    }

    prevTokenTypeRef.current = currentType;
  }, [currentTokenType, tokenType, setValue]);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

  useEffect(() => {
    if (!areGeneralFieldsFilled && showAdvancedSettings) {
      setShowAdvancedSettings(false);
    }
  }, [areGeneralFieldsFilled, showAdvancedSettings]);

  useEffect(() => {
    if (!areGeneralFieldsFilled && showDecaySettings) {
      setShowDecaySettings(false);
    }
  }, [areGeneralFieldsFilled, showDecaySettings]);

  useEffect(() => {
    if (currentTokenType === 'ownership') {
      const whitelist = getValues('transferWhitelist');
      if (whitelist?.from) {
        setValue('transferWhitelist.from', undefined);
      }
    }
  }, [currentTokenType, getValues, setValue]);

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
    const isOwnershipToken = currentTokenType === 'ownership';

    if (!whitelist?.to?.length) {
      setValue('transferWhitelist.to', [
        { type: 'space', address: '', includeSpaceMembers: true },
      ]);
    }
    if (!isOwnershipToken && !whitelist?.from?.length) {
      setValue('transferWhitelist.from', [
        { type: 'space', address: '', includeSpaceMembers: true },
      ]);
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
