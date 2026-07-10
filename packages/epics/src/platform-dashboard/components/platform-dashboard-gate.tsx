'use client';

import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@hypha-platform/ui';

export function PlatformDashboardGate({
  children,
}: {
  children: (fetchDashboard: () => Promise<Response>) => React.ReactNode;
}) {
  const [secretInput, setSecretInput] = React.useState('');
  const [activeSecret, setActiveSecret] = React.useState<string | null>(null);

  const fetchDashboard = React.useCallback(async () => {
    if (!activeSecret) {
      throw new Error('Ops secret is required');
    }
    return fetch('/api/v1/ops/platform/dashboard', {
      headers: {
        'x-hypha-ops-secret': activeSecret,
      },
    });
  }, [activeSecret]);

  if (!activeSecret) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform dashboard access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3 text-muted-foreground">
              Enter the Hypha ops secret to view platform metrics. This uses the
              same secret as space-memory ops routes. The secret stays in memory
              for this tab only and is cleared when you refresh.
            </p>
            <Input
              type="password"
              placeholder="Ops secret"
              value={secretInput}
              onChange={(event) => setSecretInput(event.target.value)}
            />
            <Button
              disabled={!secretInput.trim()}
              onClick={() => setActiveSecret(secretInput.trim())}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children(fetchDashboard)}</>;
}
