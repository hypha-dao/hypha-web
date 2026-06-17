'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';

/**
 * Internal payload keys that are implementation detail rather than something a
 * voter needs to read (e.g. the raw contract method name). Hidden from the
 * rendered card.
 */
const HIDDEN_KEYS = new Set(['contractMethod']);

const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const renderPrimitive = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const PrimitiveValue = ({ value }: { value: unknown }) => (
  <span className="text-2 font-medium text-neutral-12 break-words">
    {renderPrimitive(value)}
  </span>
);

const ListValue = ({ items }: { items: unknown[] }) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item, index) => (
      <li
        key={index}
        className="rounded-md bg-neutral-3 px-2.5 py-1.5 text-2 font-medium text-neutral-12 break-words"
      >
        {isPlainObject(item) ? (
          <NestedRows data={item} />
        ) : (
          renderPrimitive(item)
        )}
      </li>
    ))}
  </ul>
);

const ValueBlock = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-2 font-medium text-neutral-11">None</span>;
    }
    return <ListValue items={value} />;
  }
  if (isPlainObject(value)) {
    return <NestedRows data={value} />;
  }
  return <PrimitiveValue value={value} />;
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
  const entries = Object.entries(data).filter(([key]) => !HIDDEN_KEYS.has(key));
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-l-2 border-neutral-5 pl-3">
      {entries.map(([key, value]) => (
        <Field key={key} label={humanizeKey(key)} value={value} />
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
          <Field key={key} label={humanizeKey(key)} value={value} />
        ))}
      </CardContent>
    </Card>
  );
};
