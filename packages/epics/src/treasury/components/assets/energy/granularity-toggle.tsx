'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { GRANULARITIES, type Granularity } from './granularity';

export const GranularityToggle = ({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) => (
  <Tabs value={value} onValueChange={(v) => onChange(v as Granularity)}>
    <TabsList triggerVariant="switch" className="w-fit">
      {GRANULARITIES.map((g) => (
        <TabsTrigger key={g.id} value={g.id} variant="switch">
          {g.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
