'use client';

import { Button, Skeleton } from '@hypha-platform/ui';
import { CopyIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

export interface ButtonCopyUserIdProps {
  title: string;
  successMessage?: string;
  slug: string;
  isLoading?: boolean;
}

export const ButtonCopyUserId = ({
  title,
  successMessage = 'Copied!',
  slug,
  isLoading = false,
}: ButtonCopyUserIdProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(slug);
      setIsCopied(true);
      const timeoutId = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timeoutId);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Skeleton loading={isLoading} width={120} height={35}>
      <Button
        variant="outline"
        colorVariant="accent"
        title={title}
        aria-live="polite"
        aria-label={isCopied ? successMessage : title}
        onClick={handleCopy}
      >
        <CopyIcon />
        <span className="hidden md:flex">
          {isCopied ? successMessage : title}
        </span>
      </Button>
    </Skeleton>
  );
};
