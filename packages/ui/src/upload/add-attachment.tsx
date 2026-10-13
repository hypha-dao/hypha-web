'use client';
import React, { ChangeEvent, useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  X,
  File as FileIcon,
} from 'lucide-react';
import { Button } from '../button';
import { Separator } from '../separator';
import { Link2Icon } from '@radix-ui/react-icons';

type AttachmentInput = string | { name: string; url: string };

interface AddAttachmentProps {
  onChange?: (files: File[]) => void;
  onExistingAttachmentsChange?: (attachments: AttachmentInput[]) => void;
  value?: (File | AttachmentInput)[];
  defaultAttachments?: AttachmentInput[];
  label?: React.ReactNode;
  /** Comma-separated input accept list, for example `image/png,.pdf`. */
  accept?: string;
  maxFiles?: number;
  maxBytes?: number;
}

function fileMatchesAccept(file: File, accept: string) {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export const AddAttachment: React.FC<AddAttachmentProps> = ({
  onChange,
  onExistingAttachmentsChange,
  value,
  defaultAttachments,
  label = 'Add Attachment (JPEG, PNG, WebP, or PDF — max 16MB)',
  accept,
  maxFiles,
  maxBytes,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    AttachmentInput[]
  >(defaultAttachments || []);

  React.useEffect(() => {
    if (value) {
      const files = value.filter((item) => item instanceof File) as File[];
      const urls = value.filter(
        (item) =>
          !(item instanceof File) &&
          (typeof item === 'string' ||
            (typeof item === 'object' && item !== null && 'url' in item)),
      ) as AttachmentInput[];
      setAttachments(files);
      setExistingAttachments(urls);
    } else if (defaultAttachments && defaultAttachments.length > 0) {
      setExistingAttachments(defaultAttachments);
    } else if (!value && !defaultAttachments) {
      setAttachments([]);
      setExistingAttachments([]);
    }
  }, [value, defaultAttachments]);

  const handleUpload = (files: FileList) => {
    const incoming = Array.from(files).filter((file) => {
      if (accept && !fileMatchesAccept(file, accept)) return false;
      if (maxBytes != null && file.size > maxBytes) return false;
      return true;
    });
    const room =
      maxFiles == null
        ? incoming
        : incoming.slice(0, Math.max(0, maxFiles - attachments.length));
    const updated = [...attachments, ...room];
    setAttachments(updated);
    onChange?.(updated);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    onChange?.(updated);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const renderFileIcon = (file: File | AttachmentInput) => {
    if (file instanceof File) {
      if (file.type.startsWith('image/')) {
        return <ImageIcon className="h-5 w-5 shrink-0 text-neutral-11" />;
      }

      if (
        file.type === 'application/pdf' ||
        file.type === 'text/plain' ||
        file.type.includes('word') ||
        file.name.match(/\.(docx?|pdf|txt)$/i)
      ) {
        return <FileText className="w-5 h-5 text-neutral-11" />;
      }

      return <FileIcon className="w-5 h-5 text-neutral-11" />;
    } else {
      const url = typeof file === 'string' ? file : file.url;
      const fileName =
        typeof file === 'string'
          ? url.split('/').pop() || 'attachment'
          : file.name || url.split('/').pop() || 'attachment';
      const ext = fileName.split('.').pop()?.toLowerCase();

      if (ext?.match(/(png|jpe?g|gif|webp|bmp|svg)/)) {
        return <ImageIcon className="h-5 w-5 shrink-0 text-neutral-11" />;
      }

      if (ext?.match(/(pdf|docx?|txt)/)) {
        return <FileText className="w-5 h-5 text-neutral-11" />;
      }

      return <FileIcon className="w-5 h-5 text-neutral-11" />;
    }
  };

  const getFileName = (file: File | AttachmentInput): string => {
    if (file instanceof File) {
      return file.name;
    }
    if (typeof file === 'string') {
      return file.split('/').pop() || 'attachment';
    }
    return file.name || file.url.split('/').pop() || 'attachment';
  };

  const handleRemoveExisting = (index: number) => {
    const updated = existingAttachments.filter((_, i) => i !== index);
    setExistingAttachments(updated);
    onExistingAttachmentsChange?.(updated);
  };

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-end">
      <Button
        variant="ghost"
        colorVariant="accent"
        type="button"
        onClick={handleClick}
        className="h-auto w-full min-w-0 max-w-full justify-start whitespace-normal text-left text-accent-11 hover:bg-accent-3 hover:text-neutral-12 [&_svg]:shrink-0 [&_svg]:text-accent-11 hover:[&_svg]:text-neutral-12"
      >
        <Link2Icon />
        <span className="min-w-0 flex-1 break-words text-left">{label}</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
              handleUpload(e.target.files);
            }
          }}
        />
      </Button>

      <div className="mt-4 w-full min-w-0 max-w-full space-y-2">
        {existingAttachments.map((file, idx) => (
          <div
            key={`existing-${idx}-${
              typeof file === 'string' ? file : file.url
            }`}
            className="flex min-w-0 items-center justify-between rounded p-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              {renderFileIcon(file)}
              <span className="truncate text-neutral-11">
                {getFileName(file)}
              </span>
            </div>
            <Button variant="ghost" onClick={() => handleRemoveExisting(idx)}>
              <X className="text-neutral-11" size={16} />
            </Button>
          </div>
        ))}
        {attachments.map((file, idx) => (
          <div
            key={`${file.name}-${file.size}-${idx}`}
            className="flex min-w-0 items-center justify-between rounded p-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              {renderFileIcon(file)}
              <span className="truncate text-neutral-11">{file.name}</span>
            </div>
            <Button variant="ghost" onClick={() => handleRemove(idx)}>
              <X className="text-neutral-11" size={16} />
            </Button>
          </div>
        ))}
      </div>
      <Separator className="max-w-full" />
    </div>
  );
};
