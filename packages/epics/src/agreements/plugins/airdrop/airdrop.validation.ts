import { z } from 'zod';
import { ETH_ADDRESS_REGEX } from '../components/common/recipient-field.validation';

/**
 * Maximum number of mint/transfer actions allowed in a single Airdrop proposal.
 *
 * The on-chain contracts impose NO hard limit: `DAOProposalsImplementation`
 * only requires at least one transaction, and the per-space `Executor` runs the
 * whole batch in an unbounded loop inside a single transaction
 * (`Executor.executeTransactions`). The real constraints are gas-based:
 *
 *  - `createProposal` stores every `(target, value, data)` action on-chain.
 *    A transfer/mint action stores ~68 bytes of calldata plus struct fields,
 *    costing roughly ~80–100k gas each.
 *  - On approval, the Executor re-runs all actions in ONE atomic transaction:
 *    an ERC-20 `transfer` is ~50–65k gas and a space-token `mint` is ~80–120k
 *    gas, plus a small per-iteration loop overhead.
 *  - A single failing sub-call reverts the entire batch.
 *
 * On Base (block gas limit well above ~100M), even 50 mint actions is roughly
 * ~6M gas to execute and ~5M gas to create — comfortably within a single block
 * and a single transaction, with large headroom. We cap at 50 to keep the form
 * responsive and the all-or-nothing batch easy to reason about, while leaving a
 * wide safety margin below any chain limit.
 */
export const MAX_AIRDROP_RECIPIENTS = 50;

export type AirdropMethod = 'transfer' | 'mint';

/** A single recipient row: who receives tokens and how much. */
export const airdropRecipientSchema = z.object({
  recipient: z
    .string()
    .min(1, { message: 'Recipient is required' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
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

export type AirdropRecipient = z.infer<typeof airdropRecipientSchema>;

/**
 * The token and method (mint/transfer) are chosen once and apply to every
 * recipient; only the amount can differ per recipient.
 */
export const airdropSchema = z.object({
  method: z.enum(['transfer', 'mint']),
  token: z.preprocess(
    (val) => (val === undefined || val === null ? '' : val),
    z.string().min(1, { message: 'Please select a token' }),
  ),
  recipients: z
    .array(airdropRecipientSchema)
    .min(1, { message: 'At least one airdrop recipient is required' })
    .max(MAX_AIRDROP_RECIPIENTS, {
      message: 'Too many recipients for one airdrop proposal.',
    }),
});

export type AirdropFormValue = z.infer<typeof airdropSchema>;

export const schemaAirdrop = z.object({ airdrop: airdropSchema });
