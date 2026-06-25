export const DEFAULT_IMAGE_ACCEPT = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const ECOSYSTEM_LOGO_IMAGE_ACCEPT = [
  ...DEFAULT_IMAGE_ACCEPT,
  'image/svg+xml',
];

export const DEFAULT_DOCUMENT_ACCEPT = ['application/pdf'];

/** Standard max upload size for UploadThing routes (pdf/image/blob) and client validation. */
export const UPLOADTHING_STANDARD_MAX_BYTES = 16 * 1024 * 1024;

export const UPLOADTHING_STANDARD_MAX_SIZE_LABEL = '16 MB';

/** UploadThing `maxFileSize` route config string. */
export const UPLOADTHING_STANDARD_MAX_FILE_SIZE = '16MB' as const;

/** Standard max files per attachment upload (proposals, chat, profile images). */
export const UPLOADTHING_STANDARD_MAX_FILE_COUNT = 5;

export const UPLOADTHING_ATTACHMENTS_LIMIT_MESSAGE =
  `You can attach up to ${UPLOADTHING_STANDARD_MAX_FILE_COUNT} files. Please remove the extra attachments.` as const;

/** @deprecated Prefer UPLOADTHING_STANDARD_MAX_BYTES */
export const ALLOWED_IMAGE_FILE_SIZE = UPLOADTHING_STANDARD_MAX_BYTES;

export const DEFAULT_FILE_ACCEPT = ([] as string[]).concat(
  ...DEFAULT_IMAGE_ACCEPT,
  ...DEFAULT_DOCUMENT_ACCEPT,
);

export const DEFAULT_SPACE_LEAD_IMAGE = '/placeholder/space-lead-image.webp';
export const DEFAULT_SPACE_AVATAR_IMAGE = '/placeholder/space-avatar-image.svg';
