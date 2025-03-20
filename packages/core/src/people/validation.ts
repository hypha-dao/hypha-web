import { z } from 'zod';

const editPersonWeb2Props = {
  id: z.number(),
  name: z.string().min(1, {
    message: "Name must not be empty"
  }),
  surname: z.string().min(1, {
    message: "Surname must not be empty"
  }),
  nickname: z.string().min(1).max(12, {
    message: "Description length should not exceed 12 characters"
  }),
  description: z.string().min(1, {
    message: "Description must not be empty",
  }).max(300, {
    message: "Description length should not exceed 300 characters"
  }),
  leadImageUrl: z.string().url({ message: "Lead image must be a valid URL" }).optional(),
};

export const schemaEditPersonWeb2 = z.object(editPersonWeb2Props);
