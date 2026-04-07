'use client';
import React from 'react';
import Link from 'next/link';
import { FileText, File as FileIcon } from 'lucide-react';
import { Separator } from '../separator';
import { Label } from '../label';

interface Attachment {
  name: string;
  url: string;
}

interface AttachmentListProps {
  attachments: (string | Attachment)[];
}

function isString(variable: any): variable is string {
  return typeof variable === 'string';
}

function isAttachment(variable: unknown): variable is Attachment {
  if (typeof variable !== 'object' || variable === null) return false;
  const v = variable as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.url === 'string';
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
}) => {
  const renderFileIcon = (url: string) => {
    const fileName = url.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext?.match(/(png|jpe?g|gif|webp|bmp|svg)/)) {
      return (
        <img
          src={url}
          alt={fileName}
          className="w-5 h-5 object-cover rounded-lg"
        />
      );
    }

    if (ext?.match(/(pdf|docx?|txt)/)) {
      return <FileText className="w-5 h-5 text-neutral-11" />;
    }

    return <FileIcon className="w-5 h-5 text-neutral-11" />;
  };

  return (
    <div className="flex flex-col w-full">
      {attachments.length > 0 && <Label>Attachments</Label>}
      <div className="space-y-2 mt-2 w-full">
        {attachments.map((attachment, idx) => {
          const fileName = isString(attachment)
            ? (attachment.split('/').pop() || `Document ${idx + 1}`).split(
                /[?#]/,
              )[0]
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
                {renderFileIcon(url)}
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
