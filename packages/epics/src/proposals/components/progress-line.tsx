import * as React from 'react';
import { Progress } from '@hypha-platform/ui';

interface ProgressLineProps {
  label: string;
  value: number;
  indicatorColor?: string;
}

export function ProgressLine({
  label,
  value,
  indicatorColor,
}: ProgressLineProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-1">
        <div>{label}</div>
        <div>{value}%</div>
      </div>
      <Progress value={value} indicatorColor={indicatorColor} className="h-1" />
    </div>
  );
}
