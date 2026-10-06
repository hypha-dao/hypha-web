'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  buildTokenHoldingsCsv,
  tokenHoldingsCsvFilename,
} from '@hypha-platform/core/client';

import {
  downloadCsv,
  fetchTokenHoldings,
  TOKEN_HOLDINGS_EXPORT_QUERY,
} from './token-holdings-api';

type UseExportTokenHoldersArgs = {
  spaceSlug: string;
  getAccessToken: (() => Promise<string | null>) | undefined;
  tokenAddress?: string;
  tokenSymbol?: string;
};

export function useExportTokenHolders({
  spaceSlug,
  getAccessToken,
  tokenAddress,
  tokenSymbol,
}: UseExportTokenHoldersArgs) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const [isExporting, setIsExporting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const inFlightRef = React.useRef(false);

  const exportHolders = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const data = await fetchTokenHoldings(spaceSlug, getAccessToken, {
        ...TOKEN_HOLDINGS_EXPORT_QUERY,
        ...(tokenAddress ? { tokenAddress } : {}),
      });
      if (data.holders_complete === false) {
        setErrorMessage(tTokenHoldings('exportHoldersIncomplete'));
        return;
      }
      if (data.tokens.length === 0) {
        setErrorMessage(tTokenHoldings('exportHoldersError'));
        return;
      }
      const csv = buildTokenHoldingsCsv(data.tokens);
      downloadCsv(
        tokenHoldingsCsvFilename(spaceSlug, new Date(), tokenSymbol),
        csv,
      );
    } catch {
      setErrorMessage(tTokenHoldings('exportHoldersError'));
    } finally {
      inFlightRef.current = false;
      setIsExporting(false);
    }
  }, [getAccessToken, spaceSlug, tTokenHoldings, tokenAddress, tokenSymbol]);

  return { isExporting, errorMessage, exportHolders };
}
