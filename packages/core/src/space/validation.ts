import {
  ALLOWED_IMAGE_FILE_SIZE,
  DEFAULT_IMAGE_ACCEPT,
  ECOSYSTEM_LOGO_IMAGE_ACCEPT,
} from '../assets/constant';
import { z } from 'zod';
import { CATEGORIES, SPACE_FLAGS } from '../categories/types';

/** Shared Hypha space slug rule (forms, APIs, MCP tools). */
export const spaceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9'-]+$/,
    'Slug must contain only lowercase letters, numbers, hyphens, and apostrophes',
  );

/** Query params for `GET /api/v1/spaces/[spaceSlug]/members` pagination. */
export const spaceMembersHttpPaginationQuerySchema = z
  .object({
    page: z.union([z.string(), z.number()]).optional(),
    pageSize: z.union([z.string(), z.number()]).optional(),
  })
  .transform((v) => {
    const rawPage =
      v.page !== undefined && v.page !== ''
        ? Number.parseInt(String(v.page), 10)
        : 1;
    const rawSize =
      v.pageSize !== undefined && v.pageSize !== ''
        ? Number.parseInt(String(v.pageSize), 10)
        : 10;
    return {
      page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      pageSize: Number.isInteger(rawSize) && rawSize > 0 ? rawSize : 10,
    };
  });

/** `!opaque:server` where server may include extra colons (ports, IPv6 literals). */
const matrixRoomIdSchema = z
  .string()
  .trim()
  .regex(/^![^:]+:.+$/, 'Invalid Matrix room id format');

const SVG_FALLBACK_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

const isAcceptedSvgFallbackFile = (file: File) => {
  const isSvgByName = /\.svg$/i.test(file.name);
  return isSvgByName && SVG_FALLBACK_MIME_TYPES.has(file.type);
};

const isAcceptedSpaceLogoFile = (file: File) => {
  if (ECOSYSTEM_LOGO_IMAGE_ACCEPT.includes(file.type)) {
    return true;
  }

  return isAcceptedSvgFallbackFile(file);
};

const isAcceptedEcosystemLogoFile = (file: File) => {
  const ecosystemLogoAccept =
    ECOSYSTEM_LOGO_IMAGE_ACCEPT.length > 0
      ? ECOSYSTEM_LOGO_IMAGE_ACCEPT
      : DEFAULT_IMAGE_ACCEPT;
  if (ecosystemLogoAccept.includes(file.type)) {
    return true;
  }
  return false;
};

const createSpaceWeb2Props = {
  title: z
    .string()
    .trim()
    .min(1, 'Please enter your space name')
    .max(50, 'Title must contain at most 50 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Please add the purpose of your space')
    .max(300, 'Description must contain at most 300 characters'),
  slug: spaceSlugSchema.optional(),
  ecosystemLogoUrlLight: z.string().url().optional(),
  ecosystemLogoUrlDark: z.string().url().optional(),
  web3SpaceId: z.number().optional(),
  parentId: z.number().nullable(),
  categories: z.array(z.enum(CATEGORIES)).default([]),
  links: z
    .array(
      z.string().url('Please enter a valid URL (e.g., https://example.com)'),
    )
    .max(3)
    .default([]),
  address: z.string().optional(),
  flags: z.array(z.enum(SPACE_FLAGS)).default([]),
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
  access: z.number().int().min(0).max(3).optional(),
  discoverability: z.number().int().min(0).max(3).optional(),
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
        (file) => isAcceptedSpaceLogoFile(file),
        'File must be an image (JPEG, PNG, GIF, WEBP, or SVG)',
      ),
  ]),
  leadImage: z.union([
    z.string().url('A space banner is required'),
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
  ecosystemLogoUrlLight: z
    .union([
      z.string().url('A light ecosystem logo must be a valid URL'),
      z
        .instanceof(File)
        .refine(
          (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
          'File size must be less than 4MB',
        )
        .refine(
          (file) => isAcceptedEcosystemLogoFile(file),
          'File must be an image (JPEG, PNG, GIF, or WEBP)',
        ),
    ])
    .optional(),
  ecosystemLogoUrlDark: z
    .union([
      z.string().url('A dark ecosystem logo must be a valid URL'),
      z
        .instanceof(File)
        .refine(
          (file) => file.size <= ALLOWED_IMAGE_FILE_SIZE,
          'File size must be less than 4MB',
        )
        .refine(
          (file) => isAcceptedEcosystemLogoFile(file),
          'File must be an image (JPEG, PNG, GIF, or WEBP)',
        ),
    ])
    .optional(),
};

export const schemaCreateSpaceFiles = z.object(createSpaceFiles);
export const updateSpaceProps = {
  ...createSpaceWeb2Props,
  logoUrl: z
    .string()
    .url('A space icon must be a valid URL')
    .nullable()
    .optional(),
  leadImage: z
    .string()
    .url('A space banner must be a valid URL')
    .nullable()
    .optional(),
  ecosystemLogoUrlLight: z
    .string()
    .url('A light ecosystem logo must be a valid URL')
    .nullable()
    .optional(),
  ecosystemLogoUrlDark: z
    .string()
    .url('A dark ecosystem logo must be a valid URL')
    .nullable()
    .optional(),
  title: createSpaceWeb2Props.title.optional(),
  description: createSpaceWeb2Props.description.optional(),
  categories: createSpaceWeb2Props.categories.optional(),
  links: createSpaceWeb2Props.links.optional(),
  flags: createSpaceWeb2Props.flags.optional(),
  chatRoomId: matrixRoomIdSchema.nullable().optional(),
};

export const schemaUpdateSpace = z.object(updateSpaceProps);

export const schemaCreateSpace = z.object({
  ...createSpaceWeb2Props,
  ...createSpaceWeb3Props,
});
