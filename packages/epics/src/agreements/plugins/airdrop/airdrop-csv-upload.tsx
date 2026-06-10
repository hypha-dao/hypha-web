'use client';

import React from 'react';
import { Button } from '@hypha-platform/ui';
import { UploadIcon, DownloadIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import { AirdropRecipient, MAX_AIRDROP_RECIPIENTS } from './airdrop.validation';
import { AirdropCsvLineError, parseAirdropCsv } from './parse-airdrop-csv';

const CSV_TEMPLATE = [
  'recipient,amount',
  '0x1111111111111111111111111111111111111111,100',
  '0x2222222222222222222222222222222222222222,42.5',
].join('\n');

const MAX_VISIBLE_LINE_ERRORS = 5;

type FileError =
  | { type: 'read' }
  | { type: 'empty' }
  | { type: 'tooMany'; count: number };

interface AirdropCsvUploadProps {
  onRecipientsParsed: (recipients: AirdropRecipient[]) => void;
  /** Recipients already in the form (e.g. carried over from manual entry). */
  currentCount: number;
}

export const AirdropCsvUpload = ({
  onRecipientsParsed,
  currentCount,
}: AirdropCsvUploadProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [loaded, setLoaded] = React.useState<{
    fileName: string;
    count: number;
    total: string;
  } | null>(null);
  const [fileError, setFileError] = React.useState<FileError | null>(null);
  const [lineErrors, setLineErrors] = React.useState<AirdropCsvLineError[]>([]);

  const handleFile = async (file: File) => {
    setLoaded(null);
    setFileError(null);
    setLineErrors([]);

    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError({ type: 'read' });
      return;
    }

    const { recipients, errors } = parseAirdropCsv(text);

    // Require a fully clean file: silently dropping bad lines could send an
    // incomplete airdrop without the creator noticing.
    if (errors.length > 0) {
      setLineErrors(errors);
      return;
    }
    if (recipients.length === 0) {
      setFileError({ type: 'empty' });
      return;
    }
    if (recipients.length > MAX_AIRDROP_RECIPIENTS) {
      setFileError({ type: 'tooMany', count: recipients.length });
      return;
    }

    const total = recipients.reduce(
      (sum, { amount }) => sum + parseFloat(amount),
      0,
    );
    setLoaded({
      fileName: file.name,
      count: recipients.length,
      total: total.toLocaleString(),
    });
    onRecipientsParsed(recipients);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'airdrop-recipients.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const lineErrorMessage = (error: AirdropCsvLineError) => {
    switch (error.type) {
      case 'columns':
        return tAgreementFlow('plugins.airdrop.csvErrorColumns', {
          line: error.line,
        });
      case 'invalidAddress':
        return tAgreementFlow('plugins.airdrop.csvErrorInvalidAddress', {
          line: error.line,
        });
      case 'invalidAmount':
        return tAgreementFlow('plugins.airdrop.csvErrorInvalidAmount', {
          line: error.line,
        });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.airdrop.csvFormatDescription', {
          max: MAX_AIRDROP_RECIPIENTS,
        })}
      </span>

      <pre className="rounded-lg border border-neutral-6 bg-neutral-2 p-3 text-1 text-neutral-11 overflow-x-auto">
        {CSV_TEMPLATE}
      </pre>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            // Allow re-selecting the same file after a fix.
            event.target.value = '';
          }}
        />
        <Button
          variant="outline"
          colorVariant="neutral"
          className="gap-2"
          onClick={(event) => {
            event.preventDefault();
            inputRef.current?.click();
          }}
        >
          <UploadIcon />
          {tAgreementFlow('plugins.airdrop.csvChooseFile')}
        </Button>
        <Button
          variant="ghost"
          className="gap-2"
          onClick={(event) => {
            event.preventDefault();
            handleDownloadTemplate();
          }}
        >
          <DownloadIcon />
          {tAgreementFlow('plugins.airdrop.csvDownloadTemplate')}
        </Button>
      </div>

      {loaded ? (
        <div className="flex items-center justify-between rounded-lg border border-neutral-6 p-3">
          <span className="text-2 text-neutral-11">
            {tAgreementFlow('plugins.airdrop.csvLoadedSummary', {
              count: loaded.count,
              total: loaded.total,
              fileName: loaded.fileName,
            })}
          </span>
          <Button
            variant="ghost"
            className="gap-2 text-2"
            onClick={(event) => {
              event.preventDefault();
              setLoaded(null);
              onRecipientsParsed([]);
            }}
          >
            <Cross2Icon />
            {tAgreementFlow('plugins.airdrop.csvClear')}
          </Button>
        </div>
      ) : currentCount > 0 ? (
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.airdrop.csvCurrentRecipients', {
            count: currentCount,
          })}
        </span>
      ) : null}

      {fileError ? (
        <span className="text-1 text-error-11">
          {fileError.type === 'read'
            ? tAgreementFlow('plugins.airdrop.csvErrorRead')
            : fileError.type === 'empty'
            ? tAgreementFlow('plugins.airdrop.csvErrorEmpty')
            : tAgreementFlow('plugins.airdrop.csvErrorTooMany', {
                count: fileError.count,
                max: MAX_AIRDROP_RECIPIENTS,
              })}
        </span>
      ) : null}

      {lineErrors.length > 0 ? (
        <div className="flex flex-col gap-1">
          {lineErrors.slice(0, MAX_VISIBLE_LINE_ERRORS).map((error) => (
            <span
              key={`${error.line}-${error.type}`}
              className="text-1 text-error-11"
            >
              {lineErrorMessage(error)}
            </span>
          ))}
          {lineErrors.length > MAX_VISIBLE_LINE_ERRORS ? (
            <span className="text-1 text-error-11">
              {tAgreementFlow('plugins.airdrop.csvErrorMore', {
                count: lineErrors.length - MAX_VISIBLE_LINE_ERRORS,
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
