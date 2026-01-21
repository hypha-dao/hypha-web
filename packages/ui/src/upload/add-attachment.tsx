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
}

export const AddAttachment: React.FC<AddAttachmentProps> = ({
  onChange,
  onExistingAttachmentsChange,
  value,
  defaultAttachments,
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
    const newFiles = Array.from(files);
    const updated = [...attachments, ...newFiles];
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
        const objectURL = URL.createObjectURL(file);
        return (
          <img
            src={objectURL}
            alt={file.name}
            className="w-5 h-5 object-cover rounded-lg"
            onLoad={() => URL.revokeObjectURL(objectURL)}
          />
        );
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
    <div className="flex flex-col items-end w-full">
      <Button variant="ghost" onClick={handleClick} type="button">
        <Link2Icon />
        Add Attachment (JPEG, PNG, WebP, or PDF — max 4MB)
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
              handleUpload(e.target.files);
            }
          }}
        />
      </Button>

      <div className="mt-4 space-y-2 w-full">
        {existingAttachments.map((file, idx) => (
          <div
            key={`existing-${idx}-${
              typeof file === 'string' ? file : file.url
            }`}
            className="flex items-center justify-between text-sm p-2 rounded"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {renderFileIcon(file)}
              <span className="text-neutral-11 truncate">
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
            className="flex items-center justify-between text-sm p-2 rounded"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {renderFileIcon(file)}
              <span className="text-neutral-11 truncate">{file.name}</span>
            </div>
            <Button variant="ghost" onClick={() => handleRemove(idx)}>
              <X className="text-neutral-11" size={16} />
            </Button>
          </div>
        ))}
      </div>
      <Separator />
    </div>
  );
};
