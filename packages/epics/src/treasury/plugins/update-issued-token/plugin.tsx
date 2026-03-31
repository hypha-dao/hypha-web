'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Separator,
  Skeleton,
  Switch,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY,
  type UpdateIssuedTokenResubmitPayload,
} from '../../../proposals/update-issued-token-resubmit';
import {
  getPriceCurrencyCode,
  type Person,
  type Space,
  useTokenOnChainData,
} from '@hypha-platform/core/client';
import {
  GeneralTokenSettings,
  AdvancedSettingsToggle,
  DecaySettingsToggle,
  AdvancedTokenSettings,
  SelectTokenField,
  DecaySettingsField,
} from '../../components';
import { useDbTokens } from '../../../hooks';
import { useTokenSupply } from '../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { normalizeMaxSupplyHuman } from '../../utils/normalize-max-supply-human';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const MAX_SUPPLY_TYPE_OPTIONS = {
  immutable: {
    label: 'Forever Immutable',
    value: 'immutable' as const,
  },
  updatable: {
    label: 'Updatable Over Time',
    value: 'updatable' as const,
  },
} as const;

function maxSupplyTypeFromFixedFlag(
  fixed: boolean | undefined,
): { label: string; value: 'immutable' | 'updatable' } | undefined {
  if (fixed === undefined) {
    return undefined;
  }
  return fixed
    ? MAX_SUPPLY_TYPE_OPTIONS.immutable
    : MAX_SUPPLY_TYPE_OPTIONS.updatable;
}

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
  const { lang } = useParams();
  const tTreasury = useTranslations('TreasuryTab');
  const tProposalDetails = useTranslations('ProposalDetails');
  const { control, getValues, setValue, watch } = useFormContext();
  const [tokenType, setTokenType] = useState<string>('');
  const [showDecaySettings, setShowDecaySettings] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const selectedTokenAddress = watch('tokenAddress') || null;
  const watchedType = watch('type');

  useEffect(() => {
    if (watchedType) {
      setTokenType(watchedType);
    }
  }, [watchedType]);

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

  const prevShowAdvancedSettingsRef = useRef(showAdvancedSettings);

  useEffect(() => {
    const prev = prevShowAdvancedSettingsRef.current;
    if (prev === true && showAdvancedSettings === false) {
      clearAdvancedSettingsFields();
    }
    prevShowAdvancedSettingsRef.current = showAdvancedSettings;
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
      let whitelist = getValues('transferWhitelist');
      const isOwnershipToken = currentTokenType === 'ownership';

      if (!whitelist) {
        whitelist = {};
        setValue('transferWhitelist', whitelist, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }

      if (whitelist?.to === undefined) {
        setValue('transferWhitelist.to', [], {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
      if (!isOwnershipToken && whitelist?.from === undefined) {
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

  const { tokens: dbTokens, isLoading: isTokensLoading } = useDbTokens();
  const spaceTokens = useMemo(() => {
    return dbTokens.filter((t) => t.spaceId === spaceId);
  }, [dbTokens, spaceId]);

  const selectedToken = useMemo(() => {
    return spaceTokens.find((t) => t.address === selectedTokenAddress);
  }, [spaceTokens, selectedTokenAddress]);

  /** Stable across SWR reference churn so DB hydration effect does not re-fire every poll */
  const selectedTokenFingerprint = useMemo(() => {
    if (!selectedToken) return '';
    return JSON.stringify({
      address: selectedToken.address,
      name: selectedToken.name,
      symbol: selectedToken.symbol,
      type: selectedToken.type,
      maxSupply: selectedToken.maxSupply,
      iconUrl: selectedToken.iconUrl,
      transferable: selectedToken.transferable,
      isVotingToken: selectedToken.isVotingToken,
      decayInterval: selectedToken.decayInterval,
      decayPercentage: selectedToken.decayPercentage,
      archived: selectedToken.archived,
      referenceCurrency: selectedToken.referenceCurrency,
      referencePrice: selectedToken.referencePrice,
    });
  }, [selectedToken]);

  const { data: onChainData, isLoading: isLoadingOnChainData } =
    useTokenOnChainData(selectedTokenAddress as `0x${string}` | undefined);

  const lastHydratedTokenAddressRef = useRef<string | null>(null);
  const lastOnChainFingerprintRef = useRef<string>('');

  useEffect(() => {
    lastOnChainFingerprintRef.current = '';
  }, [selectedTokenAddress]);

  useEffect(() => {
    if (!selectedTokenAddress) {
      lastHydratedTokenAddressRef.current = null;
      return;
    }
    if (!selectedToken) {
      return;
    }

    const tokenAddressChanged =
      lastHydratedTokenAddressRef.current !== selectedTokenAddress;
    lastHydratedTokenAddressRef.current = selectedTokenAddress;

    const shouldShowAdvancedFromDb =
      selectedToken.referenceCurrency !== undefined &&
      selectedToken.referencePrice !== undefined;
    const iconFromDb = selectedToken.iconUrl || '';

    setValue('name', selectedToken.name);
    setValue('symbol', selectedToken.symbol);
    const currentIcon = getValues('iconUrl');
    if (tokenAddressChanged || !(currentIcon instanceof File)) {
      setValue('iconUrl', iconFromDb, { shouldDirty: false });
      setValue('initialIconUrl', iconFromDb, { shouldDirty: false });
    }
    setValue('type', selectedToken.type);
    const max = normalizeMaxSupplyHuman(selectedToken.maxSupply ?? 0);
    setValue('enableLimitedSupply', max > 0, { shouldDirty: false });
    setValue('maxSupply', max, { shouldDirty: false });
    if (max <= 0) {
      setValue('maxSupplyType', undefined, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    setValue('transferable', selectedToken.transferable);
    setValue('isVotingToken', selectedToken.isVotingToken);
    setValue('decaySettings', {
      decayInterval: selectedToken.decayInterval || 2592000,
      decayPercentage: selectedToken.decayPercentage || 1,
    });
    setValue('archiveToken', selectedToken.archived);
    setValue('referenceCurrency', selectedToken.referenceCurrency);
    setValue('tokenPrice', selectedToken.referencePrice);
    if (shouldShowAdvancedFromDb) {
      setValue('enableTokenPrice', true);
    } else {
      setValue('enableTokenPrice', false);
    }
    setTokenType(selectedToken.type);
    setShowAdvancedSettings((prev) => prev || shouldShowAdvancedFromDb);
  }, [selectedTokenAddress, selectedTokenFingerprint, setValue, getValues]);

  useEffect(() => {
    if (isLoadingOnChainData || !onChainData) {
      return;
    }

    const fp = JSON.stringify(onChainData);
    if (fp === lastOnChainFingerprintRef.current) {
      return;
    }
    lastOnChainFingerprintRef.current = fp;

    let enableAdvancedTransferControls = false;
    if (onChainData.name !== undefined) {
      setValue('name', onChainData.name);
    }
    if (onChainData.symbol !== undefined) {
      setValue('symbol', onChainData.symbol);
    }
    let normalizedMaxFromChain: number | undefined;
    if (onChainData.maxSupply !== undefined) {
      const max = normalizeMaxSupplyHuman(onChainData.maxSupply);
      normalizedMaxFromChain = max;
      setValue('enableLimitedSupply', max > 0, { shouldDirty: false });
      setValue('maxSupply', max, { shouldDirty: false });
    }
    const chainType = maxSupplyTypeFromFixedFlag(onChainData.fixedMaxSupply);
    const maxForType =
      normalizedMaxFromChain ??
      normalizeMaxSupplyHuman(Number(getValues('maxSupply')) || 0);
    if (chainType && maxForType > 0) {
      setValue('maxSupplyType', chainType, {
        shouldDirty: false,
        shouldValidate: false,
      });
    } else if (onChainData.fixedMaxSupply !== undefined && maxForType <= 0) {
      setValue('maxSupplyType', undefined, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    if (onChainData.transferable !== undefined) {
      setValue('transferable', onChainData.transferable);
    }
    if (onChainData.autoMinting !== undefined) {
      setValue('enableProposalAutoMinting', onChainData.autoMinting);
    }
    if (
      onChainData.tokenPrice !== undefined &&
      onChainData.priceCurrencyFeed !== undefined
    ) {
      setValue('enableTokenPrice', true);
      enableAdvancedTransferControls = true;
    } else {
      setValue('enableTokenPrice', false);
    }
    if (onChainData.tokenPrice !== undefined) {
      setValue('tokenPrice', onChainData.tokenPrice);
    }
    if (onChainData.priceCurrencyFeed !== undefined) {
      const referenceCurrency = getPriceCurrencyCode(
        onChainData.priceCurrencyFeed,
      );
      setValue('referenceCurrency', referenceCurrency);
    }
    const currentDecaySettings = getValues('decaySettings') || {};
    const newDecaySettings = { ...currentDecaySettings };
    if (onChainData.decayPercentage !== undefined) {
      newDecaySettings.decayPercentage = onChainData.decayPercentage;
    }
    if (onChainData.decayInterval !== undefined) {
      newDecaySettings.decayInterval = onChainData.decayInterval;
    }
    if (
      onChainData.decayPercentage !== undefined ||
      onChainData.decayInterval !== undefined
    ) {
      setValue('decaySettings', newDecaySettings);
      enableAdvancedTransferControls = true;
    }
    if (
      onChainData.useTransferWhitelist !== undefined ||
      onChainData.useReceiveWhitelist !== undefined
    ) {
      const advanced =
        onChainData.useTransferWhitelist || onChainData.useReceiveWhitelist;
      enableAdvancedTransferControls =
        enableAdvancedTransferControls || (advanced ?? false);
      setValue(
        'enableAdvancedTransferControls',
        !!(onChainData.useTransferWhitelist || onChainData.useReceiveWhitelist),
        { shouldDirty: false, shouldValidate: false },
      );
    }
    if (onChainData.archiveToken !== undefined) {
      setValue('archiveToken', onChainData.archiveToken);
    }
    setShowAdvancedSettings((prev) => prev || enableAdvancedTransferControls);
  }, [isLoadingOnChainData, onChainData, setValue, getValues]);

  const resubmitOverlayAppliedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!selectedTokenAddress || isLoadingOnChainData) {
      return;
    }
    if (resubmitOverlayAppliedRef.current) {
      return;
    }

    const raw = sessionStorage.getItem(RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY);
    if (!raw) {
      return;
    }

    let payload: UpdateIssuedTokenResubmitPayload;
    try {
      payload = JSON.parse(raw) as UpdateIssuedTokenResubmitPayload;
    } catch {
      return;
    }

    if (payload.tokenAddress !== selectedTokenAddress) {
      return;
    }

    const patch = (
      name: string,
      value: unknown,
      options?: { shouldDirty?: boolean; shouldValidate?: boolean },
    ) =>
      setValue(name as never, value as never, {
        shouldDirty: options?.shouldDirty ?? true,
        shouldValidate: options?.shouldValidate ?? false,
        ...options,
      });

    patch('name', payload.name);
    patch('symbol', payload.symbol);
    if (payload.type) {
      patch('type', payload.type);
      setTokenType(payload.type);
    }
    if (payload.iconUrl !== undefined) {
      patch('iconUrl', payload.iconUrl);
      setValue('initialIconUrl', payload.iconUrl, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    patch('enableLimitedSupply', payload.enableLimitedSupply, {
      shouldDirty: false,
    });
    patch('maxSupply', normalizeMaxSupplyHuman(payload.maxSupply ?? 0), {
      shouldDirty: false,
    });
    if (payload.maxSupplyType) {
      patch('maxSupplyType', payload.maxSupplyType, { shouldDirty: false });
    }
    if (payload.transferable !== undefined) {
      patch('transferable', payload.transferable);
    }
    patch('isVotingToken', payload.isVotingToken);
    patch('decaySettings', payload.decaySettings);
    patch('enableProposalAutoMinting', payload.enableProposalAutoMinting);
    patch('enableTokenPrice', payload.enableTokenPrice);
    if (payload.enableTokenPrice) {
      patch('tokenPrice', payload.tokenPrice);
      patch('referenceCurrency', payload.referenceCurrency);
    } else {
      patch('tokenPrice', undefined);
      patch('referenceCurrency', undefined);
    }
    patch(
      'enableAdvancedTransferControls',
      payload.enableAdvancedTransferControls,
    );
    patch('archiveToken', payload.archiveToken);

    const showAdv =
      payload.enableLimitedSupply ||
      payload.enableTokenPrice ||
      payload.enableAdvancedTransferControls ||
      !payload.enableProposalAutoMinting ||
      (payload.type === 'voice' &&
        (payload.decaySettings.decayInterval !== 2592000 ||
          payload.decaySettings.decayPercentage !== 1));
    setShowAdvancedSettings(showAdv);

    if (
      payload.type === 'voice' &&
      (payload.decaySettings.decayInterval !== 2592000 ||
        payload.decaySettings.decayPercentage !== 1)
    ) {
      setShowDecaySettings(true);
    }

    resubmitOverlayAppliedRef.current = true;
    sessionStorage.removeItem(RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY);
  }, [selectedTokenAddress, isLoadingOnChainData, setValue]);

  const tokenSupply = normalizeMaxSupplyHuman(selectedToken?.maxSupply ?? 0);
  const { supply, isLoading: isLoadingSupply } = useTokenSupply(
    selectedToken?.address as `0x${string}`,
  );

  return (
    <div className="flex flex-col gap-4">
      <SelectTokenField
        label={tProposalDetails('labels.token')}
        name="tokenAddress"
        tokens={spaceTokens.map((t) => ({
          name: t.name!,
          symbol: t.symbol!,
          address: t.address!,
          iconUrl: t.iconUrl!,
        }))}
        placeholder={tTreasury('selectTokenPlaceholder')}
        emptyListMessage={tTreasury('noTokensAvailable')}
        required
      />

      {(isTokensLoading || spaceTokens.length === 0) && (
        <div className="text-2 text-neutral-11">
          {(() => {
            const clickHereText = tProposalDetails('clickHere');
            const message = tProposalDetails('noTokenCreated', {
              clickHere: '###',
            });
            const [before, after] = message.split('###');
            return (
              <>
                {before}
                <a
                  href={`/${lang}/dho/${spaceSlug}/agreements/create/issue-new-token`}
                  className="text-accent-11 underline"
                >
                  {clickHereText}
                </a>
                {after}
              </>
            );
          })()}
        </div>
      )}

      {selectedTokenAddress && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <span className="text-2 text-neutral-11">
              {tTreasury('tokenSupply')}
            </span>
            {tokenSupply === 0 ? (
              <span className="text-2 text-neutral-11 text-nowrap">
                {tTreasury('unlimitedSupply')}
              </span>
            ) : (
              <span className="text-2 text-neutral-11">
                {formatCurrencyValue(tokenSupply)}
              </span>
            )}
            <span className="text-2 text-neutral-11">
              {tTreasury('issuanceToDate')}
            </span>
            <Skeleton width={120} height={32} loading={isLoadingSupply}>
              <span className="text-2 text-neutral-11">
                {formatCurrencyValue(supply)}
              </span>
            </Skeleton>
          </div>

          <Separator />

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

          <Separator />
          <FormField
            control={control}
            name="archiveToken"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg">
                <div className="space-y-0.5">
                  <FormLabel>{tProposalDetails('archiveToken')}</FormLabel>
                  <div className="text-2 text-neutral-11">
                    {tProposalDetails('archiveTokenDescription')}
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
