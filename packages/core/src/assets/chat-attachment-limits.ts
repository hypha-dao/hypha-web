import {
  UPLOADTHING_STANDARD_MAX_BYTES,
  UPLOADTHING_STANDARD_MAX_SIZE_LABEL,
} from './constant';

/** UploadThing attachmentUploader tier (pdf/image/blob). */
export const CHAT_ATTACHMENT_MAX_BYTES = UPLOADTHING_STANDARD_MAX_BYTES;

/** Inline base64 fallback when upload is unavailable (Vercel ~4.5MB function body limit). */
export const CHAT_INLINE_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

export const CHAT_ATTACHMENT_MAX_SIZE_LABEL =
  UPLOADTHING_STANDARD_MAX_SIZE_LABEL;

export class ChatAttachmentTooLargeError extends Error {
  readonly fileName: string;

  constructor(fileName: string) {
    super(
      `File "${fileName}" exceeds the ${CHAT_ATTACHMENT_MAX_SIZE_LABEL} attachment limit.`,
    );
    this.name = 'ChatAttachmentTooLargeError';
    this.fileName = fileName;
  }
}
