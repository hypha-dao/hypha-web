'use client';

import { Button, Skeleton } from '@hypha-platform/ui';
import { RxDownload } from 'react-icons/rx';

interface ExportEmbeddedWalletButtonProps {
  isLoading: boolean;
  isEmbeddedWallet: boolean;
  onExportEmbeddedWallet?: () => void;
  label?: string;
}

export const ExportEmbeddedWalletButton = ({
  isLoading,
  isEmbeddedWallet,
  onExportEmbeddedWallet: onExportEmbeededWallet,
  label = 'Export Keys',
}: ExportEmbeddedWalletButtonProps) =>
  isEmbeddedWallet ? (
    <Skeleton loading={isLoading} width={120} height={35}>
      <Button
        variant="ghost"
        onClick={onExportEmbeededWallet}
        className="px-1 md:px-3"
      >
        <RxDownload height={16} width={16} className="size-5 md:size-4" />
        <span className="hidden md:flex">{label}</span>
      </Button>
    </Skeleton>
  ) : null;
