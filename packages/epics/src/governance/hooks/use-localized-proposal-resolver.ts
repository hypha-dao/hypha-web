import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodTypeAny } from 'zod';
import { resolveProposalErrorTranslation } from '../../agreements/utils/proposal-error-translations';

type AgreementFlowTranslator = (
  key: any,
  values?: Record<string, string | number>,
) => string;

export const useLocalizedProposalResolver = <TSchema extends ZodTypeAny>(
  schema: TSchema,
  tAgreementFlow: AgreementFlowTranslator,
) => {
  const translateProposalError = React.useCallback(
    (message: string) => {
      const translation = resolveProposalErrorTranslation(message);

      if (!translation) {
        return message;
      }

      return tAgreementFlow(translation.key, translation.values);
    },
    [tAgreementFlow],
  );

  return React.useMemo(() => {
    const baseResolver = zodResolver(schema);

    const localizeErrors = (errors: unknown): unknown => {
      if (!errors || typeof errors !== 'object') return errors;
      if (Array.isArray(errors)) return errors.map(localizeErrors);

      const localized = { ...(errors as Record<string, unknown>) };

      if (typeof localized.message === 'string') {
        localized.message = translateProposalError(localized.message);
      }

      if (localized.types && typeof localized.types === 'object') {
        const localizedTypes: Record<string, unknown> = { ...localized.types };
        for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
          if (typeof typeValue === 'string') {
            localizedTypes[typeKey] = translateProposalError(typeValue);
          }
        }
        localized.types = localizedTypes;
      }

      for (const [key, value] of Object.entries(localized)) {
        if (
          key === 'message' ||
          key === 'type' ||
          key === 'ref' ||
          key === 'types'
        ) {
          continue;
        }
        if (value && typeof value === 'object') {
          localized[key] = localizeErrors(value);
        }
      }

      return localized;
    };

    return async (...args: Parameters<typeof baseResolver>) => {
      const result = await baseResolver(...args);
      return {
        ...result,
        errors: localizeErrors(result.errors) as typeof result.errors,
      };
    };
  }, [schema, translateProposalError]);
};
