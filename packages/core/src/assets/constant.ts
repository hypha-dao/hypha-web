export const DEFAULT_IMAGE_ACCEPT = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const DEFAULT_DOCUMENT_ACCEPT = ['application/pdf'];

export const ALLOWED_IMAGE_FILE_SIZE = 4 * 1024 * 1024;

export const DEFAULT_FILE_ACCEPT = ([] as string[]).concat(
  ...DEFAULT_IMAGE_ACCEPT,
  ...DEFAULT_DOCUMENT_ACCEPT,
);

export const DEFAULT_SPACE_LEAD_IMAGE = '/placeholder/space-lead-image.webp';
export const DEFAULT_SPACE_AVATAR_IMAGE = '/placeholder/space-avatar-image.svg';
