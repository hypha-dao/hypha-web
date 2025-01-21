'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { FilterMenu, Skeleton } from '@hypha-platform/ui';
import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader } from '@hypha-platform/ui';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@hypha-platform/ui';

export type OneChartPoint = {
  month: string;
  value: number;
  date: string;
};

export type ChartData = {
  data: OneChartPoint[];
  isLoading?: boolean;
};

const chartConfig = {
  desktop: {
    label: 'Rate',
    color: 'hsl(var(--warning-11))',
  },
} satisfies ChartConfig;

const sortOptions = [
  { label: 'All', value: 'all' },
  { label: 'Last 6 months', value: 'last6months' },
];

const filterLast6Months = (data: OneChartPoint[]) => {
  const currentDate = new Date();
  const sixMonthsAgo = new Date(
    currentDate.setMonth(currentDate.getMonth() - 6)
  );

  return data.filter((item) => new Date(item.date) >= sixMonthsAgo);
};

export function TokenBalanceChart({ data, isLoading }: ChartData) {
  const [filteredData, setFilteredData] = useState<OneChartPoint[]>(data);
  const [filterValue, setFilterValue] = useState<string>('all');

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
  };

  useEffect(() => {
    if (filterValue === 'last6months') {
      setFilteredData(filterLast6Months(data));
    } else {
      setFilteredData(data);
    }
  }, [filterValue, data]);
  return (
    <Skeleton width="100%" height="520px" loading={isLoading}>
      <Card className="bg-transparent border-0 p-0">
        <CardHeader className="flex items-end w-full">
          <FilterMenu
            value={filterValue}
            onChange={handleFilterChange}
            options={sortOptions}
          />
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={filteredData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />

              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 3)}
              />

              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `$${(value / 1000).toFixed(0)}K`;
                  } else {
                    return `$${value}`;
                  }
                }}
                domain={['auto', 'auto']}
                tickCount={5}
              />

              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />

              <defs>
                <linearGradient
                  id="desktop-gradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#F7931A" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F7931A" stopOpacity={0} />
                </linearGradient>
              </defs>

              <Area
                dataKey="value"
                type="natural"
                fill="url(#desktop-gradient)"
                fillOpacity={0.4}
                stroke="var(--color-desktop)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </Skeleton>
  );
}
