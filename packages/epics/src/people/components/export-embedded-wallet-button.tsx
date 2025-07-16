'use client';

import { Button, Skeleton } from '@hypha-platform/ui';
import { RxDownload } from 'react-icons/rx';

interface ExportEmbeddedWalletButtonProps {
  isLoading: boolean;
  isEmbeddedWallet: boolean;
  onExportEmbeddedWallet?: () => void;
}

export const ExportEmbeddedWalletButton = ({
  isLoading,
  isEmbeddedWallet,
  onExportEmbeddedWallet: onExportEmbeededWallet,
}: ExportEmbeddedWalletButtonProps) =>
  isEmbeddedWallet ? (
    <Skeleton loading={isLoading} width={120} height={35}>
      <Button variant="ghost" onClick={onExportEmbeededWallet}>
        <RxDownload />
        Export Keys
      </Button>
    </Skeleton>
  ) : null;
