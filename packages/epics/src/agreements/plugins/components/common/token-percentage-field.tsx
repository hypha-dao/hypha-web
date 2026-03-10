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
import { AssetItem, getTokenTypeLabel } from '../../../../treasury';
import { ChevronDownIcon } from '@radix-ui/themes';

export interface TokenPercentageFieldProps {
  value: { asset: string; percentage: string };
  onChange: (val: { asset: string; percentage: string }) => void;
  assets: AssetItem[];
}

export const TokenPercentageField = ({
  value,
  onChange,
  assets,
}: TokenPercentageFieldProps) => {
  const selectedAsset = assets.find((t) => t.address === value.asset);

  const handlePercentageChange = (percentage: string) => {
    if (percentage === '') {
      onChange({ percentage: '', asset: value.asset });
      return;
    }

    const normalizedPercentage = percentage.replace(',', '.');

    // Allow intermediate states like "12." or ".5" while typing
    if (/^\d*\.?\d{0,2}$/.test(normalizedPercentage)) {
      const numValue = parseFloat(normalizedPercentage);
      if (isNaN(numValue) || (numValue >= 0 && numValue <= 100)) {
        onChange({ percentage: normalizedPercentage, asset: value.asset });
      }
    }
  };

  const handleAssetChange = (asset: AssetItem) => {
    onChange({ percentage: value.percentage, asset: asset.address ?? '' });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 md:justify-end items-end">
      <div className="flex top-0 m-0 p-0 flex-1 min-w-0">
        <Input
          value={value.percentage ?? ''}
          type="text"
          inputMode="decimal"
          placeholder="Percentage"
          onChange={(e) => handlePercentageChange(e.target.value)}
        />
      </div>
      <div className="flex top-0 w-full sm:w-60 shrink-0 min-w-0 m-0 p-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              colorVariant="neutral"
              role="combobox"
              className="w-full text-2 md:w-72 justify-between py-2 font-normal"
            >
              <div className="flex items-center gap-2">
                {selectedAsset ? (
                  <>
                    <Image
                      src={selectedAsset.icon}
                      width={20}
                      height={20}
                      alt={selectedAsset.symbol}
                      className="mr-2 rounded-full h-4 w-4"
                    />
                    <span className="text-2 text-neutral-11">
                      {selectedAsset.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-2 text-neutral-11 whitespace-nowrap">
                    Select an asset
                  </span>
                )}
              </div>
              <ChevronDownIcon className="size-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
            {assets.length > 0 ? (
              assets.map((asset) => (
                <DropdownMenuItem
                  key={asset.address}
                  onSelect={() => handleAssetChange(asset)}
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
                    {asset?.space?.title ? (
                      <span className="text-1 text-accent-11">
                        by {asset?.space?.title}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <span className="text-2 text-neutral-11">No assets found</span>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
