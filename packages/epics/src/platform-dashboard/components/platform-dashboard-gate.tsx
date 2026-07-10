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

const OPS_SECRET_STORAGE_KEY = 'hypha-ops-secret';

export function PlatformDashboardGate({
  children,
}: {
  children: (fetchDashboard: () => Promise<Response>) => React.ReactNode;
}) {
  const [secret, setSecret] = React.useState('');
  const [storedSecret, setStoredSecret] = React.useState<string | null>(null);

  React.useEffect(() => {
    const existing = sessionStorage.getItem(OPS_SECRET_STORAGE_KEY);
    if (existing) {
      setStoredSecret(existing);
    }
  }, []);

  const fetchDashboard = React.useCallback(async () => {
    const activeSecret = storedSecret ?? secret;
    return fetch('/api/v1/ops/platform/dashboard', {
      headers: {
        'x-hypha-ops-secret': activeSecret,
      },
    });
  }, [secret, storedSecret]);

  if (!storedSecret) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform dashboard access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3 text-muted-foreground">
              Enter the Hypha ops secret to view platform metrics. This uses the
              same secret as space-memory ops routes.
            </p>
            <Input
              type="password"
              placeholder="Ops secret"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
            <Button
              disabled={!secret.trim()}
              onClick={() => {
                sessionStorage.setItem(OPS_SECRET_STORAGE_KEY, secret.trim());
                setStoredSecret(secret.trim());
              }}
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
