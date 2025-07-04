'use client';
import React from 'react';
import Link from 'next/link';
import { FileText, File as FileIcon } from 'lucide-react';
import { Separator } from '../separator';

interface AttachmentListProps {
  attachments: string[];
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
      <div className="space-y-2 mt-2 w-full">
        {attachments.map((url, idx) => {
          const fileName = url.split('/').pop() || `Document ${idx + 1}`;
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
