import { z } from 'zod';
import {
  QUEST_DOCUMENT_LABEL,
  QUEST_PROPOSAL_DESCRIPTION_LIMIT,
} from '../space-quests/constants';
import { schemaCreateAgreementWeb2 } from './validation';

const questProposalDescription = z
  .string()
  .trim()
  .min(1, { message: 'Please add content to your proposal' })
  .max(QUEST_PROPOSAL_DESCRIPTION_LIMIT);

/**
 * Agreements and every other proposal type stay at 4000 characters.
 * A Quest document uses the shared quest proposal limit.
 */
export function parseCreateAgreementWeb2(
  arg: z.input<typeof schemaCreateAgreementWeb2>,
): z.infer<typeof schemaCreateAgreementWeb2> {
  const schema =
    arg.label === QUEST_DOCUMENT_LABEL
      ? schemaCreateAgreementWeb2.extend({
          description: questProposalDescription,
        })
      : schemaCreateAgreementWeb2;
  return schema.parse(arg);
}
