'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { usePersonByWeb3Address } from '../hooks/use-person-by-web3-address';

const HIDDEN_KEYS = new Set(['contractMethod']);

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/;
const ADDRESS_RE_G = /0x[a-fA-F0-9]{40}/g;

const PROPOSAL_DATA_KEY_MAP: Record<string, string> = {
  optimization: 'optimization',
  priorities: 'priorities',
  socialAllocation: 'socialAllocation',
  // `goalWallets` kept for proposals created before the target-wallet rename.
  goalWallets: 'targetWallets',
  targetWallets: 'targetWallets',
  energyToken: 'energyToken',
  members: 'members',
  sources: 'sources',
  settlementWindow: 'settlementWindow',
  creditPolicy: 'creditPolicy',
  debtPolicy: 'debtPolicy',
  effectiveFrom: 'effectiveFrom',
  memberAddress: 'memberAddress',
  metadataHash: 'metadataHash',
  deviceIds: 'deviceIds',
  sourceId: 'sourceId',
  sourceType: 'sourceType',
  basePricePerKwh: 'basePricePerKwh',
  ownershipToken: 'ownershipToken',
  communityProxyAddress: 'communityProxyAddress',
  settlementAddress: 'settlementAddress',
  whitelisted: 'whitelisted',
  pricePerKwh: 'pricePerKwh',
  owners: 'owners',
  name: 'name',
};

const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const shortAddr = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

const personName = (
  person?: {
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
  } | null,
) => {
  if (!person) return null;
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || null;
};

const AddressProfile = ({ address }: { address: `0x${string}` }) => {
  const { person } = usePersonByWeb3Address(address);
  const name = personName(person);
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <PersonAvatar
        avatarSrc={person?.avatarUrl ?? undefined}
        userName={name ?? undefined}
        size="sm"
        shape="circle"
      />
      <span className="font-medium text-neutral-12">
        {name ?? shortAddr(address)}
      </span>
    </span>
  );
};

const AddressAwareText = ({ text }: { text: string }) => {
  const matches = text.match(ADDRESS_RE_G);
  if (!matches) return <>{text}</>;
  const parts = text.split(ADDRESS_RE_G);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part ? <span>{part}</span> : null}
          {matches[index] ? (
            <AddressProfile address={matches[index] as `0x${string}`} />
          ) : null}
        </React.Fragment>
      ))}
    </span>
  );
};

const renderPrimitive = (
  value: unknown,
  tShared: (key: 'yes' | 'no' | 'unavailable') => string,
): string => {
  if (value === null || value === undefined) return tShared('unavailable');
  if (typeof value === 'boolean') return value ? tShared('yes') : tShared('no');
  return String(value);
};

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const PrimitiveValue = ({
  value,
  tShared,
}: {
  value: unknown;
  tShared: (key: 'yes' | 'no' | 'unavailable') => string;
}) => {
  if (typeof value === 'string' && ADDRESS_RE.test(value)) {
    return (
      <span className="text-2 font-medium text-neutral-12 break-words">
        <AddressAwareText text={value} />
      </span>
    );
  }
  return (
    <span className="text-2 font-medium text-neutral-12 break-words">
      {renderPrimitive(value, tShared)}
    </span>
  );
};

const ListValue = ({
  items,
  tShared,
}: {
  items: unknown[];
  tShared: (key: 'yes' | 'no' | 'unavailable' | 'none') => string;
}) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item, index) => (
      <li
        key={index}
        className="rounded-md bg-neutral-3 px-2.5 py-1.5 text-2 font-medium text-neutral-12 break-words"
      >
        {isPlainObject(item) ? (
          <NestedRows data={item} />
        ) : typeof item === 'string' && ADDRESS_RE.test(item) ? (
          <AddressAwareText text={item} />
        ) : (
          renderPrimitive(item, tShared)
        )}
      </li>
    ))}
  </ul>
);

const ValueBlock = ({ value }: { value: unknown }) => {
  const tShared = useTranslations('Energy.shared');

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span className="text-2 font-medium text-neutral-11">
          {tShared('none')}
        </span>
      );
    }
    return <ListValue items={value} tShared={tShared} />;
  }
  if (isPlainObject(value)) {
    return <NestedRows data={value} />;
  }
  return <PrimitiveValue value={value} tShared={tShared} />;
};

const Field = ({ label, value }: { label: string; value: unknown }) => (
  <div className="flex flex-col gap-1">
    <span className="text-1 uppercase tracking-wide text-neutral-10">
      {label}
    </span>
    <ValueBlock value={value} />
  </div>
);

const NestedRows = ({ data }: { data: Record<string, unknown> }) => {
  const t = useTranslations('Energy.proposalData');
  const entries = Object.entries(data).filter(([key]) => !HIDDEN_KEYS.has(key));
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-l-2 border-neutral-5 pl-3">
      {entries.map(([key, value]) => (
        <Field
          key={key}
          label={
            PROPOSAL_DATA_KEY_MAP[key]
              ? t(
                  PROPOSAL_DATA_KEY_MAP[
                    key
                  ] as keyof typeof PROPOSAL_DATA_KEY_MAP,
                )
              : humanizeKey(key)
          }
          value={value}
        />
      ))}
    </div>
  );
};

export const ProposalEnergyProposalData = ({
  proposalType,
  payload,
}: {
  proposalType: string;
  payload: Record<string, unknown>;
}) => {
  const t = useTranslations('Energy.proposalData');
  const entries = Object.entries(payload).filter(
    ([key, value]) => !HIDDEN_KEYS.has(key) && !isEmpty(value),
  );
  if (entries.length === 0) return null;

  return (
    <Card className="border-neutral-5">
      <CardHeader className="border-b border-neutral-5 pb-3">
        <CardTitle className="text-3">{proposalType}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        {entries.map(([key, value]) => (
          <Field
            key={key}
            label={
              PROPOSAL_DATA_KEY_MAP[key]
                ? t(
                    PROPOSAL_DATA_KEY_MAP[
                      key
                    ] as keyof typeof PROPOSAL_DATA_KEY_MAP,
                  )
                : humanizeKey(key)
            }
            value={value}
          />
        ))}
      </CardContent>
    </Card>
  );
};
