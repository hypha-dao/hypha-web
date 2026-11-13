'use client';

import React from 'react';
import { Camera } from 'lucide-react';
import { AddAttachment, type AddAttachmentHandle } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalMediaItem } from '../utils/signal-media';

type SignalImagePickerProps = {
  label: string;
  hint: React.ReactNode;
  accept: string;
  maxFiles: number;
  maxBytes: number;
  files: File[];
  kept: SignalMediaItem[];
  onFilesChange: (files: File[]) => void;
  onKeptChange: (kept: Array<string | { name?: string; url?: string }>) => void;
  disabled?: boolean;
  /** Sits in the same row, for example the video control. */
  beside?: React.ReactNode;
};

/**
 * The Images tile opens the native file dialog on the same click. The
 * attachment list stays hidden until a file is chosen, so there is no
 * second step and no second dialog.
 */
export function SignalImagePicker({
  label,
  hint,
  accept,
  maxFiles,
  maxBytes,
  files,
  kept,
  onFilesChange,
  onKeptChange,
  disabled = false,
  beside,
}: SignalImagePickerProps) {
  const attachmentRef = React.useRef<AddAttachmentHandle>(null);
  const hasImages = files.length > 0 || kept.length > 0;

  return (
    <div className="flex flex-col gap-2" data-testid="signal-image-picker">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={hasImages}
          disabled={disabled}
          onClick={() => attachmentRef.current?.openFileDialog()}
          style={{ width: 112, height: 112 }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border px-2',
            hasImages
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-background text-foreground hover:bg-neutral-2',
          )}
        >
          <Camera className="size-5" strokeWidth={1.5} aria-hidden />
          <span className="text-center text-1 leading-tight">{label}</span>
        </button>
        {beside}
      </div>
      <div className={hasImages ? 'flex flex-col gap-2' : 'sr-only'}>
        <AddAttachment
          ref={attachmentRef}
          hideTrigger
          accept={accept}
          maxFiles={maxFiles}
          maxBytes={maxBytes}
          label={hint}
          value={[...kept, ...files]}
          defaultAttachments={kept}
          onChange={onFilesChange}
          onExistingAttachmentsChange={onKeptChange}
        />
      </div>
    </div>
  );
}
