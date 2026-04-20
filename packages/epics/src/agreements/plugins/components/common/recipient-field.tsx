'use client';

import { useFormContext } from 'react-hook-form';
import { Recipient, RecipientType } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Textarea,
} from '@hypha-platform/ui';
import { Space, Person } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { resolveProposalErrorTranslation } from '../../../utils/proposal-error-translations';

export function RecipientField({
  members,
  spaces,
  defaultRecipientType = 'member',
  recipientType,
  onRecipientTypeChange,
  readOnlyDropdown,
  readOnly,
  emptyMembersMessage,
  emptySpacesMessage,
  label,
  showTabs,
  name = 'recipient',
  withMemoField = false,
}: {
  members: Person[];
  spaces?: Space[];
  defaultRecipientType?: RecipientType;
  recipientType?: RecipientType;
  onRecipientTypeChange?: (next: RecipientType) => void;
  readOnlyDropdown?: boolean;
  readOnly?: boolean;
  emptyMembersMessage?: string;
  emptySpacesMessage?: string;
  label?: string;
  showTabs?: boolean;
  name?: string;
  withMemoField?: boolean;
}) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control } = useFormContext();
  return (
    <>
      <FormField
        control={control}
        name={name}
        render={({ field: { value, onChange }, fieldState: { error } }) => {
          const translation = error?.message
            ? resolveProposalErrorTranslation(error.message)
            : null;
          const customMessage = translation
            ? tAgreementFlow(
                translation.key as Parameters<typeof tAgreementFlow>[0],
                translation.values,
              )
            : undefined;

          return (
            <FormItem>
              <FormControl>
                <Recipient
                  value={value}
                  onChange={(recipient) => {
                    onChange(recipient.address);
                  }}
                  members={members}
                  spaces={spaces}
                  defaultRecipientType={defaultRecipientType}
                  recipientType={recipientType}
                  onRecipientTypeChange={onRecipientTypeChange}
                  readOnlyDropdown={readOnlyDropdown}
                  readOnly={readOnly}
                  emptyMembersMessage={emptyMembersMessage}
                  emptySpacesMessage={emptySpacesMessage}
                  label={label}
                  showTabs={showTabs}
                />
              </FormControl>
              <FormMessage custom={customMessage} />
            </FormItem>
          );
        }}
      />
      {withMemoField && (
        <FormField
          control={control}
          name="memo"
          render={({ field }) => (
            <FormItem>
              <label className="text-2 text-neutral-11">
                {tAgreementFlow('plugins.recipient.memoOptional')}
              </label>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={tAgreementFlow(
                    'plugins.recipient.memoPlaceholder',
                  )}
                  value={field.value || ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
