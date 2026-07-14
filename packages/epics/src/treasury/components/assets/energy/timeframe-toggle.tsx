'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { TIMEFRAMES, type Timeframe } from './dummy-data';

export const TimeframeToggle = ({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
}) => {
  const t = useTranslations('Energy.timeframes');

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Timeframe)}>
      <TabsList triggerVariant="switch" className="w-fit">
        {TIMEFRAMES.map((tf) => (
          <TabsTrigger key={tf.id} value={tf.id} variant="switch">
            {t(tf.id)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
