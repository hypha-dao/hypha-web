'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { GRANULARITIES, type Granularity } from './granularity';

export const GranularityToggle = ({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) => {
  const t = useTranslations('Energy.granularities');

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Granularity)}>
      <TabsList triggerVariant="switch" className="w-fit">
        {GRANULARITIES.map((g) => (
          <TabsTrigger key={g.id} value={g.id} variant="switch">
            {t(g.id)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
