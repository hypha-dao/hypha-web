import * as React from 'react';
import { Progress } from '@hypha-platform/ui';
import { TriangleUpIcon } from '@radix-ui/react-icons';

interface ProgressLineProps {
  label: string;
  value: number;
  indicatorColor?: string;
  target?: number;
  hideTargets?: boolean;
}

export function ProgressLine({
  label,
  value,
  indicatorColor,
  target = 0,
  hideTargets,
}: ProgressLineProps) {
  let transformStyle = 'translateX(-50%)';
  if (target === 0) {
    transformStyle = 'translateX(-15%)';
  } else if (target === 100) {
    transformStyle = 'translateX(-85%)';
  }

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

        {!hideTargets && (
          <div
            className="absolute top-0 left-0 flex flex-col items-center pointer-events-none"
            style={{ left: `${target}%`, transform: transformStyle }}
          >
            <span className="absolute top-4 text-1 whitespace-nowrap text-xs">
              {target}%
            </span>
            <TriangleUpIcon className="w-[25px] h-[25px] -mt-[7px] text-accent-6" />
          </div>
        )}
      </div>
    </div>
  );
}
