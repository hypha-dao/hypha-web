'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { QuorumAndUnityChanger } from './quorum-and-unity-changer';

interface QuorumAndUnityChangerFieldProps {
  name: string;
}

export function QuorumAndUnityChangerField({
  name,
}: QuorumAndUnityChangerFieldProps) {
  const { control, setValue } = useFormContext();
  const fieldValue = useWatch({ control, name }) || { quorum: 0, unity: 0 };

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormControl>
            <QuorumAndUnityChanger
              quorum={fieldValue.quorum}
              unity={fieldValue.unity}
              onChange={(values) =>
                setValue(name, values, { shouldValidate: true })
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
