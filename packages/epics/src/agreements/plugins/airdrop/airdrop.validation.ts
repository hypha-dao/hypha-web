import { z } from 'zod';
import { ETH_ADDRESS_REGEX } from '../components/common/recipient-field.validation';

/**
 * Maximum number of mint/transfer actions allowed in a single Airdrop proposal.
 *
 * The on-chain contracts impose NO hard limit: `DAOProposalsImplementation`
 * only requires at least one transaction, and the per-space `Executor` runs the
 * whole batch in an unbounded loop inside a single transaction
 * (`Executor.executeTransactions`). The only real constraint is block gas — every
 * action is stored on `createProposal` and re-executed sequentially on approval,
 * and a single failing sub-call reverts the entire batch.
 *
 * We therefore cap the airdrop at a conservative, gas-safe number of recipients
 * so both proposal creation and execution comfortably fit within a Base block.
 */
export const MAX_AIRDROP_RECIPIENTS = 20;

export type AirdropMethod = 'transfer' | 'mint';

/** Single airdrop allocation → one mint or transfer action on execution. */
export const airdropEntrySchema = z.object({
  method: z.enum(['transfer', 'mint']),
  recipient: z
    .string()
    .min(1, { message: 'Recipient is required' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
  token: z.preprocess(
    (val) => (val === undefined || val === null ? '' : val),
    z.string().min(1, { message: 'Please select a token' }),
  ),
  amount: z.preprocess(
    (val) => (val === undefined || val === null ? '' : String(val)),
    z
      .string()
      .min(1, { message: 'Please enter an amount.' })
      .refine(
        (value) => {
          const n = parseFloat(value);
          return !Number.isNaN(n) && n > 0;
        },
        { message: 'Amount must be greater than 0' },
      ),
  ),
});

export type AirdropEntry = z.infer<typeof airdropEntrySchema>;

export const airdropField = z
  .array(airdropEntrySchema)
  .min(1, { message: 'At least one airdrop recipient is required' })
  .max(MAX_AIRDROP_RECIPIENTS, {
    message: 'Too many recipients for one airdrop proposal.',
  });

export const schemaAirdrop = z.object({ airdrop: airdropField });
