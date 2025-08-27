import { DEFAULT_IMAGE_ACCEPT } from '@hypha-platform/core/client';
import { z } from 'zod';

export const ALLOWED_IMAGE_FILE_SIZE = 4 * 1024 * 1024;

const createSpaceWeb2Props = {
  title: z
    .string()
    .min(1, 'Please enter your space name')
    .max(50, 'Title must contain at most 50 characters'),
  description: z
    .string()
    .min(1, 'Please add the purpose of your space')
    .max(300, 'Description must contain at most 300 character'),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9'-]+$/,
      'Slug must contain only lowercase letters, numbers, hyphens, and apostrophes',
    )
    .optional(),
  web3SpaceId: z.number().optional(),
  parentId: z.number().nullable(),
  categories: z
    .array(
      z.enum([
        'art',
        'biodiversity',
        'education',
        'energy',
        'events',
        'finance',
        'governance',
        'health',
        'housing',
        'land',
        'mobility',
        'ocean',
        'sandbox',
        'tech',
        'usecase',
      ]),
    )
    .default([]),
  links: z.array(z.string().url('Please enter a valid URL')).max(3).default([]),
  address: z.string().optional(),
};

export const schemaCreateSpaceWeb2 = z.object(createSpaceWeb2Props);

export const createSpaceWeb2FileUrls = {
  logoUrl: z.string().url('A space icon is required'),
  leadImage: z.string().url('A space banner is required'),
};

export const schemaCreateSpaceWeb2FileUrls = z.object(createSpaceWeb2FileUrls);

const createSpaceWeb3Props = {
  quorum: z.number().min(1).max(100).optional(),
  unity: z.number().min(1).max(100).optional(),
  votingPowerSource: z.number().min(0).max(100).optional(),
  joinMethod: z.number().min(0).max(100).optional(),
  exitMethod: z.number().min(0).max(100).optional(),
};
export const schemaCreateSpaceWeb3 = z.object(createSpaceWeb3Props);

export const createSpaceFiles = {
  logoUrl: z.union([
    z.string().url('A space icon is required'),
    z
      .instanceof(File)
      .refine(
        (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
        'File size must be less than 4MB',
      )
      .refine(
        (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
        'File must be an image (JPEG, PNG, GIF, WEBP)',
      ),
  ]),
  leadImage: z.union([
    z.string().url('A space banner is required'),
    z
      .instanceof(File)
      .refine(
        (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
        'File size must be less than 5MB',
      )
      .refine(
        (file) => DEFAULT_IMAGE_ACCEPT.includes(file.type),
        'File must be an image (JPEG, PNG, GIF, WEBP)',
      ),
  ]),
};

export const schemaCreateSpaceFiles = z.object(createSpaceFiles);
export const updateSpaceProps = {
  ...createSpaceWeb2Props,
  title: createSpaceWeb2Props.title.optional(),
  description: createSpaceWeb2Props.description.optional(),
};

export const schemaUpdateSpace = z.object(updateSpaceProps);

export const schemaCreateSpace = z.object({
  ...createSpaceWeb2Props,
  ...createSpaceWeb3Props,
});
