import * as React from 'react';
import { Progress } from '@hypha-platform/ui';

interface ProgressLineProps {
  label: string;
  value: number;
  indicatorColor?: string;
  target?: number;
}

export function ProgressLine({
  label,
  value,
  indicatorColor,
  target,
}: ProgressLineProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-1">
        <div>{label}</div>
        <div>{value.toFixed(2)}%</div>
      </div>

      <div className="relative">
        <Progress
          value={value}
          indicatorColor={indicatorColor}
          className="h-2"
        />

        {typeof target === 'number' && (
          <div
            className="absolute top-0 left-0 h-full flex flex-col items-center pointer-events-none"
            style={{ left: `${target}%`, transform: 'translateX(-50%)' }}
          >
            <div className="h-2 w-px bg-foreground" />
            <span className="absolute -top-5 text-1 whitespace-nowrap">
              {target}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
