'use client';

import { genUploader } from 'uploadthing/client';

import {
  CHAT_ATTACHMENT_MAX_BYTES,
  ChatAttachmentTooLargeError,
} from '../chat-attachment-limits';
import type { CoreFileRouter } from '../server';

const { uploadFiles } = genUploader<CoreFileRouter>();

export type ChatAttachmentUploadResult = {
  url: string;
  mediaType: string;
};

export async function uploadChatAttachmentFile(
  file: File,
  authorizationToken: string,
): Promise<ChatAttachmentUploadResult> {
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new ChatAttachmentTooLargeError(file.name);
  }

  const token = authorizationToken.trim();
  if (!token) {
    throw new Error('Authentication is required to upload attachments.');
  }

  const [uploaded] = await uploadFiles('attachmentUploader', {
    files: [file],
    headers: { Authorization: `Bearer ${token}` },
  });

  const uploadedFile = uploaded;
  if (!uploadedFile) {
    throw new Error(`Upload for "${file.name}" did not return a file URL.`);
  }

  const url = uploadedFile.ufsUrl?.trim() || uploadedFile.url?.trim();
  if (!url) {
    throw new Error(`Upload for "${file.name}" did not return a file URL.`);
  }

  return {
    url,
    mediaType:
      uploadedFile.type?.trim() || file.type || 'application/octet-stream',
  };
}
