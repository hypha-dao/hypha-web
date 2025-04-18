import { DEFAULT_IMAGE_ACCEPT } from '@core/assets';
import { z } from 'zod';

const ALLOWED_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

const createAgreementWeb2Props = {
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(300),
};

export const schemaCreateAgreementWeb2 = z.object(createAgreementWeb2Props);

export const createAgreementWeb2FileUrls = {
  leadImage: z.string().url('Lead Image URL must be a valid URL').optional(),
};

export const schemaCreateAgreementWeb2FileUrls = z.object(
  createAgreementWeb2FileUrls,
);

export const createAgreementFiles = {
  leadImage: z
    .instanceof(File)
    .refine(
      (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
      'File size must be less than 5MB',
    )
    .refine(
      (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
      'File must be an image (JPEG, PNG, GIF, WEBP)',
    )
    .optional(),
  attachments: z.array(z.instanceof(File)).optional(),
};

export const schemaCreateAgreementFiles = z.object(createAgreementFiles);

export const schemaCreateAgreement = z.object({
  ...createAgreementWeb2Props,
});
