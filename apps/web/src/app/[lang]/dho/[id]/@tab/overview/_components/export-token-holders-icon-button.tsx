'use client';

import { useTranslations } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import {
  Button,
  ErrorAlert,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';

import { useExportTokenHolders } from './use-export-token-holders';

type ExportTokenHoldersIconButtonProps = {
  spaceSlug: string;
  tokenAddress: string;
  tokenSymbol: string;
  getAccessToken: (() => Promise<string | null>) | undefined;
};

export function ExportTokenHoldersIconButton({
  spaceSlug,
  tokenAddress,
  tokenSymbol,
  getAccessToken,
}: ExportTokenHoldersIconButtonProps) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const { isExporting, errorMessage, exportHolders } = useExportTokenHolders({
    spaceSlug,
    getAccessToken,
    tokenAddress,
    tokenSymbol,
  });
  const label = tTokenHoldings('exportTokenHoldersAria', {
    tokenSymbol,
  });

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            disabled={isExporting}
            aria-busy={isExporting}
            aria-label={label}
            className="h-7 min-h-7 min-w-7 p-0"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void exportHolders();
            }}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tTokenHoldings('exportTokenHoldersTooltip')}
        </TooltipContent>
      </Tooltip>
      {errorMessage ? <ErrorAlert lines={[errorMessage]} /> : null}
    </>
  );
}
