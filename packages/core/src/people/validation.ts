import { DEFAULT_IMAGE_ACCEPT } from '@core/assets';
import { z } from 'zod';

const ALLOWED_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

const signupPersonWeb2Props = {
  name: z.string().min(1, { message: 'Name must not be empty' }),
  surname: z.string().min(1, { message: 'Surname must not be empty' }),
  nickname: z
    .string()
    .min(1)
    .max(12, { message: 'Nickname length should not exceed 12 characters' }),
  description: z
    .string()
    .min(1, { message: 'Description must not be empty' })
    .max(300, {
      message: 'Description length should not exceed 300 characters',
    }),
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' })
    .max(100, { message: 'Email must be at most 100 characters long' }),
  location: z
    .string()
    .min(2, { message: 'Location must be at least 2 characters long' })
    .max(100, { message: 'Location must be at most 100 characters long' })
    .trim()
    .optional(),
  address: z
    .string()
    .trim()
    .refine((value) => /^(0x)?[0-9a-fA-F]{40}$/.test(value), {
      message: 'Invalid Ethereum address',
    }),
  links: z
    .array(z.string().url('Links must be a valid URL'))
    .max(3)
    .default([]),
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
    .min(1, { message: 'Description must not be empty' })
    .max(300, {
      message: 'Description length should not exceed 300 characters',
    }),
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' })
    .max(100, { message: 'Email must be at most 100 characters long' }),
  location: z
    .string()
    .min(2, { message: 'Location must be at least 2 characters long' })
    .max(100, { message: 'Location must be at most 100 characters long' })
    .trim()
    .optional(),
  links: z
    .array(z.string().url('Links must be a valid URL'))
    .max(3)
    .default([]),
};

export const editPersonFiles = z.object({
  avatarUrl: z
    .union([
      z.string().url('Avatar URL must be a valid URL'),
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
    ])
    .optional(),
  leadImageUrl: z
    .union([
      z.string().url('Lead Image URL must be a valid URL'),
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
    ])
    .optional(),
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
