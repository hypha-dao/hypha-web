'use client';
import React, { ChangeEvent, useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  X,
  File as FileIcon
} from 'lucide-react';
import { Button } from '../button';
import { Separator } from '../separator';
import { Link2Icon } from '@radix-ui/react-icons';

interface AddAttachmentProps {
  onChange?: (files: File[]) => void;
}

export const AddAttachment: React.FC<AddAttachmentProps> = ({ onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleUpload = (files: FileList) => {
    const newFiles = Array.from(files);
    const updated = [...attachments, ...newFiles];
    setAttachments(updated);
    onChange?.(updated);
  };

  const handleRemove = (fileName: string) => {
    const updated = attachments.filter((file) => file.name !== fileName);
    setAttachments(updated);
    onChange?.(updated);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const renderFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="w-5 h-5 object-cover rounded-lg"
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
  };

  return (
    <div className="flex flex-col items-end w-full">
      <Button variant="ghost" onClick={handleClick}>
        <Link2Icon />
        Add Attachment
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
        {attachments.map((file, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-sm p-2 rounded"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {renderFileIcon(file)}
              <span className="text-neutral-11 truncate">{file.name}</span>
            </div>
            <Button variant="ghost" onClick={() => handleRemove(file.name)}>
              <X className="text-neutral-11" size={16} />
            </Button>
          </div>
        ))}
      </div>
      <Separator />
    </div>
  );
};
