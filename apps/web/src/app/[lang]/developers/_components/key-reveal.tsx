'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@hypha-platform/ui';

/**
 * Shows a client key once. It lives only in this component's state: it is not
 * stored, logged or sent anywhere, and it is gone when the person closes it.
 */
export function KeyReveal({
  clientName,
  clientKey,
  onClose,
}: {
  clientName: string;
  clientKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clientKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-none border border-border bg-background-2 p-4"
    >
      <p className="text-2 font-semibold text-foreground">
        Key for {clientName}: shown only once
      </p>
      <code className="break-all rounded-none border border-border bg-background px-3 py-2 text-1 text-foreground">
        {clientKey}
      </code>
      <p className="text-1 text-muted-foreground">
        Copy it now; it cannot be shown again. It belongs on the
        application&apos;s server only: never in browser code, a repository or a
        chat. If it is lost, rotate the key.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void copy()}>
          {copied ? (
            <Check className="mr-1 size-4" />
          ) : (
            <Copy className="mr-1 size-4" />
          )}
          {copied ? 'Copied' : 'Copy key'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          I have stored it, hide
        </Button>
      </div>
    </div>
  );
}
