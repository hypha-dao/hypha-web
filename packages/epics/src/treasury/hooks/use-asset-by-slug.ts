'use client';

import useSWR from 'swr';
import { data } from './use-asset-by-slug.mock';

type OneChartPoint = {
  month: string;
  value: number;
  date: string;
};

type TransactionCardProps = {
  id: string;
  title: string;
  description: string;
  amount: number;
  withUsdSymbol?: boolean;
  badges: {
    label: string;
    variant: 'solid' | 'soft' | 'outline' | 'surface';
  }[];
  author: {
    name: string;
    surname: string;
  };
  isLoading?: boolean;
  viewCount?: number;
  commentCount?: number;
};

type AssetItem = {
  icon: string;
  name: string;
  symbol: string;
  value: number;
  usdEqual: number;
  status: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
};

export const getAssetBySlug = async (
  slug: string,
): Promise<AssetItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((asset) => asset.slug === slug));
    }, 100);
  });
};

export const useAssetBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['asset-by-slug', slug], ([_, slug]) =>
    getAssetBySlug(slug),
  );
  return { data, isLoading };
};
