import { z } from 'zod';

export const schemaSpaceBankCustomerOnboarding = z
  .object({
    legalName: z.string().trim().min(1, 'legalName is required').max(1024),
    contactEmail: z.string().trim().email('contactEmail must be a valid email'),
    endorsements: z.array(z.string()).optional(),
  })
  .strict();

export type SpaceBankCustomerOnboardingInput = z.infer<
  typeof schemaSpaceBankCustomerOnboarding
>;
