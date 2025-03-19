import { z } from 'zod';

const editPersonWeb2Props = {
  name: z.string().min(1),
  surname: z.string().min(1),
  nickname: z.string().min(1).max(12),
  description: z.string().min(1).max(300),
  leadImageUrl: z.string().url('Lead image must be a valid URL').optional(),
};

export const schemaEditPersonWeb2 = z.object(editPersonWeb2Props);
