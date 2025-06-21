'use client';

import { Slider } from '@hypha-platform/ui';
import { useEffect, useState } from 'react';

interface QuorumAndUnityChangerProps {
  quorum: number;
  unity: number;
  onChange: (values: { quorum: number; unity: number }) => void;
  disabled?: boolean;
}

export function QuorumAndUnityChanger({
  quorum = 0,
  unity = 0,
  onChange,
  disabled,
}: QuorumAndUnityChangerProps) {
  const [localQuorum, setLocalQuorum] = useState(quorum);
  const [localUnity, setLocalUnity] = useState(unity);

  useEffect(() => {
    setLocalQuorum(quorum);
  }, [quorum]);

  useEffect(() => {
    setLocalUnity(unity);
  }, [unity]);

  const handleQuorumChange = (value: number[]) => {
    setLocalQuorum(value[0]);
    onChange({ quorum: value[0], unity: localUnity });
  };

  const handleUnityChange = (value: number[]) => {
    setLocalUnity(value[0]);
    onChange({ quorum: localQuorum, unity: value[0] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-2 text-neutral-11 w-full">Quorum</label>
        <div className="w-full max-w-[340px] flex items-center gap-2">
          <Slider
            value={[localQuorum]}
            onValueChange={handleQuorumChange}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
          />
          <span className="text-sm text-neutral-11">{localQuorum}%</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-2 text-neutral-11 w-full">Unity</label>
        <div className="w-full max-w-[340px] flex items-center gap-2">
          <Slider
            value={[localUnity]}
            onValueChange={handleUnityChange}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
          />
          <span className="text-sm text-neutral-11">{localUnity}%</span>
        </div>
      </div>
    </div>
  );
}
