import { useFormContext } from 'react-hook-form';
import { Recipient } from '../fields/recipient';
import { PaymentFormValues } from '../../schemas/payment-form-plugin-schema';

export const PaymentFormPlugin = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<PaymentFormValues>();

  const recipientRegister = register('recipient');

  return (
    <div>
      <Recipient
        {...recipientRegister}
        error={errors.recipient?.message}
        onChange={(value) => recipientRegister.onChange({ target: { value } })}
        recipients={[]}
      />
    </div>
  );
};
