'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import {
  buildTokenHoldingsCsv,
  tokenHoldingsCsvFilename,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';

import {
  downloadCsv,
  fetchTokenHoldings,
  TOKEN_HOLDINGS_EXPORT_QUERY,
} from './token-holdings-api';

type ExportTokenHoldersButtonProps = {
  spaceSlug: string;
  getAccessToken: (() => Promise<string | null>) | undefined;
};

export function ExportTokenHoldersButton({
  spaceSlug,
  getAccessToken,
}: ExportTokenHoldersButtonProps) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const [isExporting, setIsExporting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const handleExport = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const data = await fetchTokenHoldings(
        spaceSlug,
        getAccessToken,
        TOKEN_HOLDINGS_EXPORT_QUERY,
      );
      const csv = buildTokenHoldingsCsv(data.tokens);
      downloadCsv(tokenHoldingsCsvFilename(spaceSlug), csv);
    } catch {
      setErrorMessage(tTokenHoldings('exportHoldersError'));
    } finally {
      inFlightRef.current = false;
      setIsExporting(false);
    }
  }, [getAccessToken, spaceSlug, tTokenHoldings]);

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
          void handleExport();
        }}
      >
        <Download className="mr-1 size-3.5" />
        {isExporting
          ? tTokenHoldings('exportingHolders')
          : tTokenHoldings('exportHolders')}
      </Button>
      {errorMessage ? (
        <span className="text-1 text-error-11">{errorMessage}</span>
      ) : null}
    </div>
  );
}
