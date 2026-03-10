import { ALLOWED_IMAGE_FILE_SIZE, DEFAULT_IMAGE_ACCEPT } from '../assets';

import { z } from 'zod';
import { percentageStringToBigInt } from '../common';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const signupPersonWeb2Props = {
  name: z.string().trim().min(1, { message: 'Please enter your first name' }),
  surname: z.string().trim().min(1, { message: 'Please enter your last name' }),
  nickname: z
    .string()
    .trim()
    .min(1, { message: 'Please choose a nickname' })
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
    .array(
      z.string().url('Please enter a valid URL (e.g., https://example.com)'),
    )
    .max(3)
    .default([])
    .optional(),
};

const editPersonWeb2Props = {
  id: z.number(),
  name: z.string().trim().min(1, { message: 'Please enter your first name' }),
  surname: z.string().trim().min(1, { message: 'Please enter your last name' }),
  nickname: z
    .string()
    .trim()
    .min(1, { message: 'Please choose a nickname' })
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
    .array(
      z.string().url('Please enter a valid URL (e.g., https://example.com)'),
    )
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
          'Your file is too large and exceeds the 4MB limit. Please upload a smaller file',
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

export const personTransfer = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),

  payouts: z
    .array(
      z.object({
        amount: z.string().refine((value) => parseFloat(value) > 0, {
          message: 'Amount must be greater than 0',
        }),
        token: z.string(),
      }),
    )
    .min(1, { message: 'At least one payout is required' }),
  memo: z.string().optional(),
});

export const personRedeem = z.object({
  redemptions: z
    .array(
      z.object({
        spaceSlug: z.string().min(1, { message: 'Space is required' }),
        token: z.string().min(1, { message: 'Token is required' }),
        amount: z.string().refine((value) => parseFloat(value) > 0, {
          message: 'Amount must be greater than 0',
        }),
      }),
    )
    .length(1, { message: 'Only one redemption is required' }),
  conversions: z
    .array(
      z.object({
        asset: z
          .string()
          .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
        percentage: z
          .string()
          .refine(
            (value) => parseFloat(value) >= 0 && parseFloat(value) <= 100,
            {
              message: 'Amount must be between 0 and 100',
            },
          ),
      }),
    )
    .min(1, { message: 'At least one conversation is required' })
    .refine(
      (value) =>
        value.reduce(
          (acc, curr) => acc + percentageStringToBigInt(curr.percentage),
          0n,
        ) === 10000n,
      {
        message: 'Summary percentage must be 100%',
      },
    ),
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
