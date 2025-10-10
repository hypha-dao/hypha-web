import { z } from 'zod';
import { isAddress } from 'ethers';

export const arrayOfAddresses = z
  .string()
  .transform((val) => val.split(',').filter((addr) => isAddress(addr)));

export const stringifiedDate = z.string().transform((val, ctx) => {
  const timestamp = Number(val);
  const date = new Date(isNaN(timestamp) ? val : timestamp);

  if (isNaN(date.getTime())) {
    ctx.addIssue({ code: 'invalid_type', expected: 'date' });

    return z.NEVER;
  }

  return date;
});

export const blockNumber = z.coerce.number().int().positive();

export const schemaGetTransfersQuery = z.object({
  token: arrayOfAddresses.catch([]),
  fromDate: stringifiedDate.optional().catch(undefined),
  toDate: stringifiedDate.optional().catch(undefined),
  fromBlock: blockNumber.optional().catch(undefined),
  toBlock: blockNumber.optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(50).catch(10),
});
