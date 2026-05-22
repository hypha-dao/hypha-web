'use client';

import { FC, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { copyToClipboard, cn } from '@hypha-platform/ui-utils';

import { BANKING_COPYABLE_SURFACE_CLASS } from '../banking-ui';

type CopyableInstructionBlockProps = {
  label: string;
  value: string;
  displayValue?: string;
};

export const CopyableInstructionBlock: FC<CopyableInstructionBlockProps> = ({
  label,
  value,
  displayValue,
}) => {
  const t = useTranslations('BankingTab.depositInstructions');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        BANKING_COPYABLE_SURFACE_CLASS,
        'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/35',
      )}
      aria-label={copied ? t('copied') : t('copy')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-1 font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 whitespace-pre-line break-all font-mono text-2 leading-snug text-foreground">
            {displayValue ?? value}
          </p>
        </div>
        {copied ? (
          <Check
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-11"
            aria-hidden
          />
        ) : (
          <Copy
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
    </button>
  );
};
