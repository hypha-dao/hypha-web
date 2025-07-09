import { DEFAULT_IMAGE_ACCEPT } from '@core/assets';
import { z } from 'zod';

const ALLOWED_IMAGE_FILE_SIZE = 4 * 1024 * 1024;

const signupPersonWeb2Props = {
  name: z.string().min(1, { message: 'Name must not be empty' }),
  surname: z.string().min(1, { message: 'Surname must not be empty' }),
  nickname: z
    .string()
    .min(1)
    .max(12, { message: 'Nickname length should not exceed 12 characters' }),
  description: z
    .string()
    .max(300, {
      message: 'Description length should not exceed 300 characters',
    })
    .optional(),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address' })
    .max(100, { message: 'Email must be at most 100 characters long' })
    .or(z.literal(''))
    .optional(),
  location: z
    .string()
    .max(100, { message: 'Location must be at most 100 characters long' })
    .trim()
    .optional(),
  address: z
    .string()
    .trim()
    .refine((value) => /^(0x)?[0-9a-fA-F]{40}$/.test(value), {
      message: 'Invalid Ethereum address',
    })
    .optional(),
  links: z
    .array(z.string().url('Links must be a valid URL'))
    .max(3)
    .default([])
    .optional(),
};

const editPersonWeb2Props = {
  id: z.number(),
  name: z.string().min(1, { message: 'Name must not be empty' }),
  surname: z.string().min(1, { message: 'Surname must not be empty' }),
  nickname: z
    .string()
    .min(1)
    .max(12, { message: 'Nickname length should not exceed 12 characters' }),
  description: z
    .string()
    .max(300, {
      message: 'Description length should not exceed 300 characters',
    })
    .optional(),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address' })
    .max(100, { message: 'Email must be at most 100 characters long' })
    .or(z.literal(''))
    .optional(),
  location: z
    .string()
    .max(100, { message: 'Location must be at most 100 characters long' })
    .trim()
    .optional(),
  links: z
    .array(z.string().url('Links must be a valid URL'))
    .max(3)
    .default([])
    .optional(),
};

export const editPersonFiles = z.object({
  avatarUrl: z
    .union([
      z.string().url('Avatar URL must be a valid URL'),
      z.literal(''),
      z.null(),
      z.undefined(),
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
    ])
    .optional()
    .transform((val) => (val === '' || val === null ? undefined : val)),
  leadImageUrl: z
    .union([
      z.string().url('Lead Image URL must be a valid URL'),
      z.literal(''),
      z.null(),
      z.undefined(),
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
    ])
    .optional()
    .transform((val) => (val === '' || val === null ? undefined : val)),
});

export type PersonFiles = z.infer<typeof editPersonFiles>;

export const schemaEditPersonWeb2 = z.object(editPersonWeb2Props);

export const schemaEditPersonWeb2FileUrls = z.object({
  avatarUrl: z.string().url('Avatar URL must be a valid URL').optional(),
  leadImageUrl: z.string().url('Lead Image URL must be a valid URL').optional(),
});

export const schemaEditPerson = z.object({
  ...editPersonWeb2Props,
  ...editPersonFiles.shape,
});

export const schemaSignupPerson = z.object({
  ...signupPersonWeb2Props,
  ...editPersonFiles.shape,
});
