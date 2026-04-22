'use client';

import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@hypha-platform/ui-utils';

interface EthAdressProps {
  address: string;
  onClick?: (address: string) => void;
}

export const EthAddress = ({
  address,
  onClick = copyToClipboard,
}: EthAdressProps) => {
  const t = useTranslations('Common');
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    onClick(address);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md text-left',
        'text-neutral-11 outline-none transition-colors',
        'hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
      aria-label={copied ? t('walletAddressCopied') : t('copyWalletAddress')}
    >
      <span className="min-w-0 truncate font-mono text-1">
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {copied ? (
          <>
            <CheckIcon className="icon-sm text-success-11" aria-hidden />
            <span
              className="text-1 font-medium text-success-11 whitespace-nowrap"
              role="status"
              aria-live="polite"
            >
              {t('walletAddressCopied')}
            </span>
          </>
        ) : (
          <CopyIcon className="icon-sm" aria-hidden />
        )}
      </span>
    </button>
  );
};
