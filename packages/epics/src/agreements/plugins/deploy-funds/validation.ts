import { z } from 'zod';
import { recipientField } from '../components/common/recipient-field.validation';
import { payoutsField } from '../components/common/token-payout-field-array.validation';

export const schemaDeployFunds = z.object({
  recipient: recipientField,
  payouts: payoutsField,
});
