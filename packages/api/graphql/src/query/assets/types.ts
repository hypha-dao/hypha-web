export type AssetItem = {
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
