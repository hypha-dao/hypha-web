'use client';

import { useCallback, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Badge, Button, FormLabel, Input } from '@hypha-platform/ui';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { cn } from '@hypha-platform/ui-utils';
import { isAddress, getAddress } from 'viem';
import { useTranslations } from 'next-intl';

type AuthorizedMintersSectionProps = {
  /**
   * `create` shows a single "grant" list (initial authorized minters).
   * `update` additionally shows a "revoke" list since the on-chain minter set
   * is a non-enumerable mapping and cannot be pre-filled.
   */
  mode?: 'create' | 'update';
};

/** Subset of fields this section reads/writes on the surrounding form. */
type AuthorizedMintersFormValues = {
  authorizedMinters?: string[];
  authorizedMintersToRevoke?: string[];
};

type FieldName = 'authorizedMinters' | 'authorizedMintersToRevoke';

const normalize = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return undefined;
  try {
    return getAddress(trimmed);
  } catch {
    return undefined;
  }
};

const MinterList = ({
  name,
  labelKey,
  descKey,
}: {
  name: FieldName;
  labelKey: string;
  descKey: string;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue, getValues } =
    useFormContext<AuthorizedMintersFormValues>();
  const values = (useWatch({ control, name }) as string[] | undefined) ?? [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const normalized = normalize(draft);
    if (!normalized) {
      setError(
        tAgreementFlow('plugins.issueNewToken.authorizedMinters.invalid'),
      );
      return;
    }
    const current = getValues(name) ?? [];
    if (current.some((a) => a.toLowerCase() === normalized.toLowerCase())) {
      setError(
        tAgreementFlow('plugins.issueNewToken.authorizedMinters.duplicate'),
      );
      return;
    }
    setValue(name, [...current, normalized], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setDraft('');
    setError(null);
  }, [draft, name, getValues, setValue, tAgreementFlow]);

  const handleRemove = useCallback(
    (address: string) => {
      const current = getValues(name) ?? [];
      setValue(
        name,
        current.filter((a) => a !== address),
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [name, getValues, setValue],
  );

  return (
    <div className="flex flex-col gap-2">
      <FormLabel className="text-2 text-neutral-11">
        {tAgreementFlow(labelKey)}
      </FormLabel>
      <span className="text-1 text-neutral-10">{tAgreementFlow(descKey)}</span>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((address) => (
            <Badge
              key={address}
              variant="outline"
              className="gap-1.5 py-1 pl-2 pr-1"
            >
              <span className="text-1 font-mono">
                {`${address.slice(0, 6)}…${address.slice(-4)}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-4 w-4 rounded-full p-0')}
                onClick={() => handleRemove(address)}
                aria-label={tAgreementFlow(
                  'plugins.issueNewToken.authorizedMinters.remove',
                )}
              >
                <Cross2Icon />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 w-full">
          <Input
            placeholder={tAgreementFlow(
              'plugins.issueNewToken.authorizedMinters.placeholder',
            )}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          {error ? <span className="text-1 text-error-11">{error}</span> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          aria-label={tAgreementFlow(
            'plugins.issueNewToken.authorizedMinters.add',
          )}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
};

/**
 * Reusable "Authorized Minters" editor. Granted addresses gain mint / burnFrom /
 * batchSetCreditWhitelistAddresses rights on the token in addition to the space
 * executor/owner. Used by both the issue-new-token and update-issued-token forms.
 */
export const AuthorizedMintersSection = ({
  mode = 'create',
}: AuthorizedMintersSectionProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.authorizedMinters.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.authorizedMinters.description')}
      </span>
      <MinterList
        name="authorizedMinters"
        labelKey={
          mode === 'update'
            ? 'plugins.issueNewToken.authorizedMinters.grantLabel'
            : 'plugins.issueNewToken.authorizedMinters.listLabel'
        }
        descKey="plugins.issueNewToken.authorizedMinters.listDescription"
      />
      {mode === 'update' ? (
        <MinterList
          name="authorizedMintersToRevoke"
          labelKey="plugins.issueNewToken.authorizedMinters.revokeLabel"
          descKey="plugins.issueNewToken.authorizedMinters.revokeDescription"
        />
      ) : null}
    </div>
  );
};
