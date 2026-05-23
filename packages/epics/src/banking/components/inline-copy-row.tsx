'use client';

import { FC, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { copyToClipboard, cn } from '@hypha-platform/ui-utils';

import { BANKING_COPYABLE_SURFACE_CLASS } from '../banking-ui';

type InlineCopyRowProps = {
  label?: string | null;
  value: string;
  className?: string;
  multiline?: boolean;
};

export const InlineCopyRow: FC<InlineCopyRowProps> = ({
  label,
  value,
  className,
  multiline = false,
}) => {
  const t = useTranslations('BankingTab.depositInstructions');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      copyToClipboard(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        BANKING_COPYABLE_SURFACE_CLASS,
        'flex min-w-0 w-full px-3 py-2 text-left text-2',
        multiline ? 'items-start gap-2' : 'items-center gap-2',
        className,
      )}
      aria-label={copied ? t('copied') : t('copy')}
    >
      {label ? (
        <span className="shrink-0 text-muted-foreground">{label}:</span>
      ) : null}
      <span
        className={cn(
          'min-w-0 flex-1 font-mono text-foreground',
          multiline ? 'whitespace-pre-line' : 'truncate',
        )}
      >
        {value}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-success-11" aria-hidden />
      ) : (
        <Copy
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
    </button>
  );
};
