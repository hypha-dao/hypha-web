'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';

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

const ValueBlock = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="font-medium text-neutral-11">None</span>;
    }
    return (
      <ul className="flex flex-col gap-1">
        {value.map((item, index) => (
          <li key={index} className="font-medium break-all">
            {isPlainObject(item) ? (
              <NestedRows data={item} />
            ) : (
              renderPrimitive(item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    return <NestedRows data={value} />;
  }

  return (
    <span className="font-medium break-all">{renderPrimitive(value)}</span>
  );
};

const NestedRows = ({ data }: { data: Record<string, unknown> }) => {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-l border-neutral-6 pl-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1 text-2">
          <span className="text-neutral-11">{humanizeKey(key)}</span>
          <ValueBlock value={value} />
        </div>
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
  const entries = Object.entries(payload);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{proposalType}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1 text-2">
            <span className="text-neutral-11">{humanizeKey(key)}</span>
            <ValueBlock value={value} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
