'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';

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
      <CardContent className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1 text-2">
            <span className="text-neutral-11">{key}</span>
            <span className="font-medium break-all">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
