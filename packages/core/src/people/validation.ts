import { z } from 'zod';

const editPersonWeb2Props = {
  id: z.number(),
  avatarUrl: z.union([
    z.string().url('Avatar URL must be a valid URL'),
    z
      .instanceof(File)
      .refine(
        (file) => file.size <= 5 * 1024 * 1024,
        'File size must be less than 5MB',
      ),
  ]),
  name: z.string().min(1, {
    message: 'Name must not be empty',
  }),
  surname: z.string().min(1, {
    message: 'Surname must not be empty',
  }),
  nickname: z.string().min(1).max(12, {
    message: 'Nickname length should not exceed 12 characters',
  }),
  description: z
    .string()
    .min(1, {
      message: 'Description must not be empty',
    })
    .max(300, {
      message: 'Description length should not exceed 300 characters',
    }),
  leadImageUrl: z.union([
    z.string().url('Lead Image URL must be a valid URL'),
    z
      .instanceof(File)
      .refine(
        (file) => file.size <= 5 * 1024 * 1024,
        'File size must be less than 5MB',
      ),
  ]),
};

export const schemaEditPersonWeb2 = z.object(editPersonWeb2Props);
