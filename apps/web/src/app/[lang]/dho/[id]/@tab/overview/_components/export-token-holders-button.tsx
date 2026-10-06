'use client';

import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@hypha-platform/ui';

import { useExportTokenHolders } from './use-export-token-holders';

type ExportTokenHoldersButtonProps = {
  spaceSlug: string;
  getAccessToken: (() => Promise<string | null>) | undefined;
};

export function ExportTokenHoldersButton({
  spaceSlug,
  getAccessToken,
}: ExportTokenHoldersButtonProps) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const { isExporting, errorMessage, exportHolders } = useExportTokenHolders({
    spaceSlug,
    getAccessToken,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isExporting}
        aria-busy={isExporting}
        aria-label={tTokenHoldings('exportHoldersAria')}
        onClick={() => {
          void exportHolders();
        }}
      >
        <Download className="mr-1 size-3.5" />
        {isExporting
          ? tTokenHoldings('exportingHolders')
          : tTokenHoldings('exportHolders')}
      </Button>
      {errorMessage ? (
        <span role="alert" className="text-1 text-error-11">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
