'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import { Separator } from '../separator';
import { Label } from '../label';

interface Attachment {
  name: string;
  url: string;
}

export interface AttachmentListProps {
  attachments: (string | Attachment)[];
  /** Section heading; pass a translated string (defaults to English). */
  label?: React.ReactNode;
}

function isString(variable: unknown): variable is string {
  return typeof variable === 'string';
}

function isAttachment(variable: unknown): variable is Attachment {
  if (typeof variable !== 'object' || variable === null) return false;
  const v = variable as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.url === 'string';
}

/** Last path segment or full name, without query/hash (for extension detection). */
function fileBaseNameFromHint(hint: string): string {
  const noQuery = hint.split(/[?#]/)[0] ?? '';
  const seg = noQuery.split('/').pop() ?? noQuery;
  return seg;
}

function extensionFromFileName(hint: string): string | undefined {
  const base = fileBaseNameFromHint(hint);
  if (!base.includes('.')) return undefined;
  return base.split('.').pop()?.toLowerCase();
}

function AttachmentRowImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) {
    return <ImageIcon className="h-5 w-5 shrink-0 text-neutral-11" />;
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="h-5 w-5 shrink-0 rounded-lg object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  label = 'Attachments',
}) => {
  const renderFileIcon = (url: string, displayFileName: string) => {
    const extFromName = extensionFromFileName(displayFileName);
    const extFromUrl = extensionFromFileName(url.split('/').pop() || url);
    const ext = extFromName ?? extFromUrl;

    if (ext?.match(/(png|jpe?g|gif|webp|bmp|svg)/)) {
      return <AttachmentRowImage src={url} />;
    }

    if (ext?.match(/(pdf|docx?|txt)/)) {
      return <FileText className="w-5 h-5 text-neutral-11" />;
    }

    return <FileIcon className="w-5 h-5 text-neutral-11" />;
  };

  return (
    <div className="flex flex-col w-full">
      {attachments.length > 0 && <Label>{label}</Label>}
      <div className="space-y-2 mt-2 w-full">
        {attachments.map((attachment, idx) => {
          const fileName = isString(attachment)
            ? (attachment.split('/').pop() || `Document ${idx + 1}`).split(
                /[?#]/,
              )[0] ?? `Document ${idx + 1}`
            : isAttachment(attachment)
            ? attachment.name
            : 'unnamed';
          const url = isString(attachment)
            ? attachment
            : isAttachment(attachment)
            ? attachment.url
            : '';
          return (
            <div
              key={`${fileName}-${idx}`}
              className="flex items-center justify-between text-sm py-2 rounded"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {renderFileIcon(url, fileName)}
                <Link
                  href={url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-neutral-11 underline truncate"
                >
                  {fileName}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <Separator />
    </div>
  );
};
