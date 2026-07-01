'use client';

import { FC, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';
import { copyToClipboard, cn } from '@hypha-platform/ui-utils';

type CompactCopyValueProps = {
  value: string;
  className?: string;
};

export const CompactCopyValue: FC<CompactCopyValueProps> = ({
  value,
  className,
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
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-2 text-foreground">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 px-0"
        onClick={handleCopy}
        aria-label={copied ? t('copied') : t('copy')}
      >
        {copied ? (
          <Check className="h-3 w-3 text-success-11" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
};
