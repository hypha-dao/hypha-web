'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Image,
  Input,
} from '@hypha-platform/ui';
import { getTokenTypeLabel } from '../../../../treasury';
import { ChevronDownIcon } from '@radix-ui/themes';
import { useTranslations } from 'next-intl';

export interface TokenPercentageAsset {
  address: string;
  icon: string;
  symbol: string;
  value?: number;
  usdEqual?: number;
  tokenPrice?: number;
  priceCurrencySymbol?: string;
  requestedAmount?: number;
  requestedCurrencySymbol?: string;
  availableInRedemptionToken?: number;
  redemptionTokenSymbol?: string;
  type?: string | null;
  space?: {
    title: string;
    slug?: string;
  };
}

export interface ConversionAssetDropdownProps {
  value: string;
  onChange: (address: string) => void;
  assets: TokenPercentageAsset[];
}

export const ConversionAssetDropdown = ({
  value,
  onChange,
  assets,
}: ConversionAssetDropdownProps) => {
  const tRedeem = useTranslations('ProfileActions.redeemTokens');
  const selectedAsset = assets.find(
    (a) => a.address.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div className="flex top-0 min-w-0 flex-1 m-0 p-0 max-w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            colorVariant="neutral"
            role="combobox"
            className="w-full max-w-full min-w-0 text-2 justify-between py-2 font-normal"
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedAsset ? (
                <>
                  <Image
                    src={selectedAsset.icon}
                    width={20}
                    height={20}
                    alt={selectedAsset.symbol}
                    className="mr-2 rounded-full h-4 w-4 shrink-0"
                  />
                  <span className="text-2 text-neutral-11 truncate">
                    {selectedAsset.symbol}
                  </span>
                </>
              ) : (
                <span className="text-2 text-neutral-11 whitespace-nowrap">
                  {tRedeem('form.selectCollateralAsset')}
                </span>
              )}
            </div>
            <ChevronDownIcon className="size-2 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
          {assets.length > 0 ? (
            assets.map((asset) => (
              <DropdownMenuItem
                key={asset.address}
                onSelect={() => onChange(asset.address)}
              >
                <Image
                  src={asset.icon}
                  width={24}
                  height={24}
                  alt={asset.symbol}
                  className="mr-2 rounded-full h-5 w-5"
                />
                <div className="flex flex-col">
                  <span className="flex gap-2 items-center">
                    <span className="text-2 text-neutral-11">
                      {asset.symbol}
                    </span>
                    {asset?.type && (
                      <div className="rounded-lg text-[10px] text-accent-11 border-1 border-accent-11 px-2 py-0.75">
                        {getTokenTypeLabel(asset.type)}
                      </div>
                    )}
                  </span>
                  <div className="flex flex-col">
                    {asset?.space?.title ? (
                      <span className="text-1 text-accent-11">
                        by {asset?.space?.title}
                      </span>
                    ) : null}
                    {typeof asset.value === 'number' ? (
                      <span className="text-1 text-neutral-11">
                        {tRedeem('conversionDetails.vaultLine', {
                          amount: asset.value.toFixed(2),
                          symbol: asset.symbol,
                        })}
                      </span>
                    ) : null}
                    {typeof asset.tokenPrice === 'number' &&
                    Number.isFinite(asset.tokenPrice) ? (
                      <span className="text-1 text-neutral-11">
                        {tRedeem('conversionDetails.priceLine', {
                          currency: asset.priceCurrencySymbol ?? '$',
                          price: asset.tokenPrice.toFixed(2),
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <span className="text-2 text-neutral-11">
              {tRedeem('form.noCollateralAssetsFound')}
            </span>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export interface ConversionPercentageInputProps {
  value: string;
  onChange: (percentage: string) => void;
  className?: string;
}

export const ConversionPercentageInput = ({
  value,
  onChange,
  className,
}: ConversionPercentageInputProps) => {
  const handlePercentageChange = (percentage: string) => {
    if (percentage === '') {
      onChange('');
      return;
    }

    const normalizedPercentage = percentage.replace(',', '.');

    if (/^\d*\.?\d{0,2}$/.test(normalizedPercentage)) {
      const numValue = parseFloat(normalizedPercentage);
      if (isNaN(numValue) || (numValue >= 0 && numValue <= 100)) {
        onChange(normalizedPercentage);
      }
    }
  };

  return (
    <div
      className={
        className ?? 'flex top-0 m-0 p-0 w-[6.75rem] shrink-0 max-w-[6.75rem]'
      }
    >
      <Input
        value={value ?? ''}
        type="text"
        inputMode="decimal"
        placeholder="%"
        rightIcon={<>%</>}
        className="w-full min-w-0"
        onChange={(e) => handlePercentageChange(e.target.value)}
      />
    </div>
  );
};

export interface ConversionFieldDetailsProps {
  asset: TokenPercentageAsset | undefined;
}

export const ConversionFieldDetails = ({
  asset,
}: ConversionFieldDetailsProps) => {
  const tRedeem = useTranslations('ProfileActions.redeemTokens');
  if (!asset) return null;

  const parts: string[] = [];
  if (typeof asset.value === 'number') {
    parts.push(
      tRedeem('conversionDetails.vaultLine', {
        amount: asset.value.toFixed(2),
        symbol: asset.symbol,
      }),
    );
  }
  if (
    typeof asset.tokenPrice === 'number' &&
    Number.isFinite(asset.tokenPrice)
  ) {
    parts.push(
      tRedeem('conversionDetails.priceLine', {
        currency: asset.priceCurrencySymbol ?? '$',
        price: asset.tokenPrice.toFixed(2),
      }),
    );
  }
  if (
    typeof asset.requestedAmount === 'number' &&
    Number.isFinite(asset.requestedAmount)
  ) {
    parts.push(
      tRedeem('conversionDetails.requestedLine', {
        currency: asset.requestedCurrencySymbol ?? '$',
        amount: asset.requestedAmount.toFixed(2),
      }),
    );
  }

  if (parts.length === 0) return null;

  return (
    <div className="text-1 text-neutral-11 self-end w-full min-w-0 overflow-x-auto">
      <span className="whitespace-nowrap inline-block min-w-full text-right">
        {parts.join(' · ')}
      </span>
    </div>
  );
};

export interface TokenPercentageFieldProps {
  value: { asset: string; percentage: string };
  onChange: (val: { asset: string; percentage: string }) => void;
  assets: TokenPercentageAsset[];
  showFieldDetails?: boolean;
}

/** @deprecated Prefer ConversionAssetDropdown + ConversionPercentageInput in separate FormFields */
export const TokenPercentageField = ({
  value,
  onChange,
  assets,
  showFieldDetails = false,
}: TokenPercentageFieldProps) => {
  const selectedAsset = assets.find(
    (t) => t.address.toLowerCase() === value.asset.toLowerCase(),
  );

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 md:justify-end items-end">
        <ConversionAssetDropdown
          value={value.asset}
          onChange={(asset) =>
            onChange({ percentage: value.percentage, asset })
          }
          assets={assets}
        />
        <ConversionPercentageInput
          value={value.percentage ?? ''}
          onChange={(percentage) =>
            onChange({ percentage, asset: value.asset })
          }
        />
      </div>
      {showFieldDetails ? (
        <ConversionFieldDetails asset={selectedAsset} />
      ) : null}
    </div>
  );
};
