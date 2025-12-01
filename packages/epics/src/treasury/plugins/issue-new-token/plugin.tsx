'use client';

import { Separator } from '@hypha-platform/ui';
import { DecaySettingsField } from '../../components/common/decay-settings-field';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect } from 'react';
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
    if (currentTokenType !== tokenType) {
      setTokenType(currentTokenType || '');
    }
  }, [currentTokenType, tokenType]);

  useEffect(() => {
    if (tokenType === 'voice') {
      setValue('isVotingToken', true);
    }
  }, [tokenType, setValue]);

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
      <Separator />
      <AdvancedSettingsToggle
        showAdvancedSettings={showAdvancedSettings}
        setShowAdvancedSettings={setShowAdvancedSettings}
      />
      {showAdvancedSettings && (
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
      {tokenType === 'voice' && (
        <>
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
