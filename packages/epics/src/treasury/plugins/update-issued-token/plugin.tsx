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
  UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT,
  applyUpdateIssuedTokenResubmitPayloadToForm,
  type UpdateIssuedTokenResubmitPayload,
} from '../../../proposals/update-issued-token-resubmit';
import {
  fetchWhitelistBaselineFromChain,
  getPriceCurrencyCode,
  sanitizeTokenPriceReferenceCurrency,
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
import { buildTransferWhitelistFromBaselineAddresses } from '../../utils/whitelist-baseline-to-form';
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
  /** Includes current DHO space; used to map on-chain space ids to addresses for whitelist baseline */
  spacesForChainMapping?: Space[];
  spaceSlug?: string;
  spaceId?: number;
};

export const UpdateIssuedTokenPlugin = ({
  members = [],
  spaces = [],
  spacesForChainMapping,
  spaceSlug,
  spaceId,
}: UpdateIssuedTokenPluginProps) => {
  const { lang } = useParams();
  const tTreasury = useTranslations('TreasuryTab');
  const tProposalDetails = useTranslations('ProposalDetails');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const {
    control,
    getValues,
    setValue,
    watch,
    formState: { dirtyFields },
  } = useFormContext();
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
  const chainMappingSpaces = useMemo(
    () => spacesForChainMapping ?? spaces,
    [spacesForChainMapping, spaces],
  );
  const spaceTokens = useMemo(() => {
    return dbTokens.filter((t) => t.spaceId === spaceId);
  }, [dbTokens, spaceId]);

  const selectedToken = useMemo(() => {
    if (!selectedTokenAddress) {
      return undefined;
    }
    const want = selectedTokenAddress.toLowerCase();
    return spaceTokens.find(
      (t) => typeof t.address === 'string' && t.address.toLowerCase() === want,
    );
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

    const safeRefFromDb = sanitizeTokenPriceReferenceCurrency(
      selectedToken.referenceCurrency,
    );
    const shouldShowAdvancedFromDb =
      safeRefFromDb !== undefined && selectedToken.referencePrice !== undefined;
    const iconFromDb = selectedToken.iconUrl || '';

    const setIfClean = (
      name: string,
      value: unknown,
      opts?: { shouldDirty?: boolean; shouldValidate?: boolean },
    ) => {
      if ((dirtyFields as Record<string, unknown>)?.[name]) {
        return;
      }
      setValue(name as never, value as never, {
        shouldDirty: opts?.shouldDirty ?? false,
        shouldValidate: opts?.shouldValidate ?? false,
      });
    };

    setIfClean('name', selectedToken.name);
    setIfClean('symbol', selectedToken.symbol);
    const currentIcon = getValues('iconUrl');
    if (tokenAddressChanged || !(currentIcon instanceof File)) {
      if (!(dirtyFields as Record<string, unknown>)?.iconUrl) {
        setValue('iconUrl', iconFromDb, { shouldDirty: false });
        setValue('initialIconUrl', iconFromDb, { shouldDirty: false });
      }
    }
    setIfClean('type', selectedToken.type);
    const max = normalizeMaxSupplyHuman(selectedToken.maxSupply ?? 0);
    setIfClean('enableLimitedSupply', max > 0, { shouldDirty: false });
    setIfClean('maxSupply', max, { shouldDirty: false });
    if (max <= 0 && !(dirtyFields as Record<string, unknown>)?.maxSupplyType) {
      setValue('maxSupplyType', undefined, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    setIfClean('transferable', selectedToken.transferable);
    setIfClean('isVotingToken', selectedToken.isVotingToken);
    setIfClean('decaySettings', {
      decayInterval: selectedToken.decayInterval || 2592000,
      decayPercentage: selectedToken.decayPercentage || 1,
    });
    setIfClean('archiveToken', selectedToken.archived);
    setIfClean('referenceCurrency', safeRefFromDb);
    setIfClean(
      'tokenPrice',
      safeRefFromDb !== undefined ? selectedToken.referencePrice : undefined,
    );
    if (!(dirtyFields as Record<string, unknown>)?.enableTokenPrice) {
      if (shouldShowAdvancedFromDb) {
        setValue('enableTokenPrice', true, { shouldDirty: false });
      } else {
        setValue('enableTokenPrice', false, { shouldDirty: false });
      }
    }
    setTokenType(selectedToken.type);
    setShowAdvancedSettings((prev) => prev || shouldShowAdvancedFromDb);
  }, [
    selectedTokenAddress,
    selectedTokenFingerprint,
    setValue,
    getValues,
    dirtyFields,
  ]);

  useEffect(() => {
    if (isLoadingOnChainData || !onChainData) {
      return;
    }

    const fp = JSON.stringify(onChainData);
    if (fp === lastOnChainFingerprintRef.current) {
      return;
    }
    lastOnChainFingerprintRef.current = fp;

    const df = dirtyFields as Record<string, unknown>;
    const isDirty = (k: string) => Boolean(df?.[k]);

    let enableAdvancedTransferControls = false;
    if (onChainData.name !== undefined && !isDirty('name')) {
      setValue('name', onChainData.name, { shouldDirty: false });
    }
    if (onChainData.symbol !== undefined && !isDirty('symbol')) {
      setValue('symbol', onChainData.symbol, { shouldDirty: false });
    }
    let normalizedMaxFromChain: number | undefined;
    if (onChainData.maxSupply !== undefined) {
      const max = normalizeMaxSupplyHuman(onChainData.maxSupply);
      normalizedMaxFromChain = max;
      if (!isDirty('enableLimitedSupply')) {
        setValue('enableLimitedSupply', max > 0, { shouldDirty: false });
      }
      if (!isDirty('maxSupply')) {
        setValue('maxSupply', max, { shouldDirty: false });
      }
    }
    const chainType = maxSupplyTypeFromFixedFlag(onChainData.fixedMaxSupply);
    const maxForType =
      normalizedMaxFromChain ??
      normalizeMaxSupplyHuman(Number(getValues('maxSupply')) || 0);
    if (chainType && maxForType > 0 && !isDirty('maxSupplyType')) {
      setValue('maxSupplyType', chainType, {
        shouldDirty: false,
        shouldValidate: false,
      });
    } else if (
      onChainData.fixedMaxSupply !== undefined &&
      maxForType <= 0 &&
      !isDirty('maxSupplyType')
    ) {
      setValue('maxSupplyType', undefined, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    if (onChainData.transferable !== undefined && !isDirty('transferable')) {
      setValue('transferable', onChainData.transferable, {
        shouldDirty: false,
      });
    }
    if (
      onChainData.autoMinting !== undefined &&
      !isDirty('enableProposalAutoMinting')
    ) {
      setValue('enableProposalAutoMinting', onChainData.autoMinting, {
        shouldDirty: false,
      });
    }
    const chainPriceRef = sanitizeTokenPriceReferenceCurrency(
      onChainData.priceCurrencyFeed !== undefined
        ? getPriceCurrencyCode(onChainData.priceCurrencyFeed)
        : undefined,
    );
    const hasValidChainPrice =
      onChainData.tokenPrice !== undefined &&
      onChainData.priceCurrencyFeed !== undefined &&
      chainPriceRef !== undefined;

    if (hasValidChainPrice) {
      if (!isDirty('enableTokenPrice')) {
        setValue('enableTokenPrice', true, { shouldDirty: false });
      }
      enableAdvancedTransferControls = true;
    } else if (!isDirty('enableTokenPrice')) {
      setValue('enableTokenPrice', false, { shouldDirty: false });
    }
    if (onChainData.tokenPrice !== undefined && !isDirty('tokenPrice')) {
      setValue(
        'tokenPrice',
        chainPriceRef !== undefined ? onChainData.tokenPrice : undefined,
        { shouldDirty: false },
      );
    }
    if (!isDirty('referenceCurrency')) {
      setValue('referenceCurrency', chainPriceRef, { shouldDirty: false });
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
      (onChainData.decayPercentage !== undefined ||
        onChainData.decayInterval !== undefined) &&
      !isDirty('decaySettings')
    ) {
      setValue('decaySettings', newDecaySettings, { shouldDirty: false });
      enableAdvancedTransferControls = true;
    }
    if (
      (onChainData.useTransferWhitelist !== undefined ||
        onChainData.useReceiveWhitelist !== undefined) &&
      !isDirty('enableAdvancedTransferControls')
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
    if (onChainData.archiveToken !== undefined && !isDirty('archiveToken')) {
      setValue('archiveToken', onChainData.archiveToken, {
        shouldDirty: false,
      });
    }
    setShowAdvancedSettings((prev) => prev || enableAdvancedTransferControls);
  }, [isLoadingOnChainData, onChainData, setValue, getValues, dirtyFields]);

  const resubmitOverlayAppliedRef = useRef(false);
  const resubmitHydratedRef = useRef(false);
  const baselineWhitelistAppliedForTokenRef = useRef<string | null>(null);

  useEffect(() => {
    resubmitOverlayAppliedRef.current = false;
    resubmitHydratedRef.current = false;
    baselineWhitelistAppliedForTokenRef.current = null;
  }, [selectedTokenAddress]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<UpdateIssuedTokenResubmitPayload>)
        .detail;
      if (!detail?.tokenAddress) {
        return;
      }
      const addr = getValues('tokenAddress') as string | undefined;
      if (!addr || detail.tokenAddress !== addr) {
        return;
      }
      applyUpdateIssuedTokenResubmitPayloadToForm(detail, {
        setValue,
        setTokenType,
        setShowAdvancedSettings,
        setShowDecaySettings,
      });
      resubmitOverlayAppliedRef.current = true;
      resubmitHydratedRef.current = true;
    };
    window.addEventListener(UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT, handler);
    return () =>
      window.removeEventListener(UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT, handler);
  }, [
    getValues,
    setValue,
    setTokenType,
    setShowAdvancedSettings,
    setShowDecaySettings,
  ]);

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

    applyUpdateIssuedTokenResubmitPayloadToForm(payload, {
      setValue,
      setTokenType,
      setShowAdvancedSettings,
      setShowDecaySettings,
    });

    resubmitOverlayAppliedRef.current = true;
    resubmitHydratedRef.current = true;
    sessionStorage.removeItem(RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY);
  }, [selectedTokenAddress, isLoadingOnChainData, setValue]);

  useEffect(() => {
    if (!selectedTokenAddress) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { from, to } = await fetchWhitelistBaselineFromChain({
          tokenAddress: selectedTokenAddress as `0x${string}`,
          spaces: chainMappingSpaces,
          members,
        });
        if (cancelled) {
          return;
        }

        setValue('whitelistBaselineFrom', from, {
          shouldDirty: false,
          shouldValidate: false,
        });
        setValue('whitelistBaselineTo', to, {
          shouldDirty: false,
          shouldValidate: false,
        });

        if (resubmitHydratedRef.current) {
          return;
        }

        if (
          baselineWhitelistAppliedForTokenRef.current === selectedTokenAddress
        ) {
          return;
        }

        const isOwnershipToken = selectedToken?.type === 'ownership';
        const wl = buildTransferWhitelistFromBaselineAddresses({
          from,
          to,
          members,
          spaces,
          isOwnershipToken,
        });

        const hasAddresses = from.length > 0 || to.length > 0;
        if (hasAddresses && wl) {
          setValue('transferWhitelist', wl, {
            shouldDirty: false,
            shouldValidate: false,
          });
          setValue('enableAdvancedTransferControls', true, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }

        baselineWhitelistAppliedForTokenRef.current = selectedTokenAddress;
      } catch {
        // RPC/network: leave baseline fields unset; orchestrator falls back to []
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedTokenAddress,
    selectedToken?.type,
    chainMappingSpaces,
    members,
    spaces,
    setValue,
  ]);

  /** Cap from chain (authoritative); DB maxSupply is often 0 when unlimited on-chain */
  const maxCapHumanFromChain = useMemo(() => {
    if (onChainData?.maxSupply === undefined) {
      return undefined;
    }
    return onChainData.maxSupply;
  }, [onChainData?.maxSupply]);

  const tokenSupplyMetricsLabel = useMemo(() => {
    if (isLoadingOnChainData && selectedTokenAddress) {
      return null;
    }
    if (maxCapHumanFromChain === undefined) {
      return (
        <span className="text-2 text-neutral-11 text-nowrap">
          {tTreasury('unlimitedSupply')}
        </span>
      );
    }
    if (maxCapHumanFromChain === 0) {
      return (
        <span className="text-2 text-neutral-11 text-nowrap">
          {tTreasury('unlimitedSupply')}
        </span>
      );
    }
    const typeSuffix =
      onChainData?.fixedMaxSupply === true
        ? tAgreementFlow(
            'plugins.issueNewToken.general.maxSupplyTypeOptions.immutable',
          )
        : onChainData?.fixedMaxSupply === false
        ? tAgreementFlow(
            'plugins.issueNewToken.general.maxSupplyTypeOptions.updatable',
          )
        : null;
    return (
      <span className="text-2 text-neutral-11">
        {formatCurrencyValue(maxCapHumanFromChain)}
        {typeSuffix ? (
          <span className="text-neutral-11"> ({typeSuffix})</span>
        ) : null}
      </span>
    );
  }, [
    isLoadingOnChainData,
    selectedTokenAddress,
    maxCapHumanFromChain,
    onChainData?.fixedMaxSupply,
    tTreasury,
    tAgreementFlow,
  ]);

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
          type: t.type,
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
            <Skeleton
              width={200}
              height={24}
              loading={Boolean(selectedTokenAddress && isLoadingOnChainData)}
            >
              {tokenSupplyMetricsLabel}
            </Skeleton>
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
