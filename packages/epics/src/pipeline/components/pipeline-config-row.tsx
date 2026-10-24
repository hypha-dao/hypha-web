'use client';

import React from 'react';
import { Button } from '@hypha-platform/ui';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type PipelineConfigRowProps = {
  children: React.ReactNode;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  disableRemove: boolean;
};

export function PipelineConfigRow({
  children,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  disableRemove,
}: PipelineConfigRowProps) {
  const t = useTranslations('Pipeline');

  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid grid-cols-1 gap-2">{children}</div>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('workflow.moveUp')}
          disabled={index === 0}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('workflow.moveDown')}
          disabled={index >= total - 1}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('workflow.remove')}
          disabled={disableRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
