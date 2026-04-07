'use client';

import { AssetCard } from './asset-card';
import { Locale } from '@hypha-platform/i18n';

type VaultCollateralCardProps = {
  icon?: string;
  name?: string;
  symbol?: string;
  value?: number;
  usdEqual?: number;
  tokenPrice?: number;
  supply?: {
    total: number;
  };
  space?: {
    title: string;
    slug: string;
  };
  createdAt?: Date;
  lang?: Locale;
  isLoading?: boolean;
};

export const VaultCollateralCard: React.FC<VaultCollateralCardProps> = ({
  icon,
  name,
  symbol,
  value,
  tokenPrice,
  supply,
  space,
  createdAt,
  lang,
  isLoading,
}) => {
  return (
    <AssetCard
      icon={icon}
      name={name}
      symbol={symbol}
      value={value}
      tokenPrice={tokenPrice}
      supply={supply}
      space={space}
      createdAt={createdAt}
      lang={lang}
      type="Collateral"
      isLoading={isLoading}
    />
  );
};
