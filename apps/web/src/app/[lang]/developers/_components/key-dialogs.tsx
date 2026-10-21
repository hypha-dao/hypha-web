'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from '@hypha-platform/ui';
import { readApiError, useDeveloperApi } from '../_lib/api';

/**
 * Shows a client key once. The key lives in component state only (never a URL,
 * storage or log). The dialog closes only through the explicit confirmation.
 */
function KeyRevealDialog({
  clientName,
  clientKey,
  onDone,
}: {
  clientName: string;
  clientKey: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clientKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setVisible(true); // Clipboard blocked: let the person select it by hand.
    }
  };

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Client key for {clientName}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2 text-2">
              <p>
                This is the only time the key is shown. Hypha stores just a
                fingerprint, so it cannot be recovered afterwards. If it is
                lost, rotate it to get a new one.
              </p>
              <ul className="list-disc pl-5">
                <li>Keep it private. Never put it in a browser app.</li>
                <li>
                  Save it in your application&apos;s <strong>server</strong>{' '}
                  environment (a secret or environment variable), not in the
                  code repository.
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            type={visible ? 'text' : 'password'}
            value={clientKey}
            aria-label="Client key"
            autoComplete="off"
            className="font-mono"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={visible ? 'Hide key' : 'Show key'}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copy key"
            onClick={() => void copy()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
        </div>

        <AlertDialogFooter>
          <Button type="button" onClick={onDone}>
            Yes, I have safely stored my private key
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Rotate the key of an approved client: explain, confirm, then show the new key
 * with the same dialog as above.
 */
export function RotateKeyButton({
  slug,
  clientName,
  onRotated,
}: {
  slug: string;
  clientName: string;
  onRotated: () => void;
}) {
  const api = useDeveloperApi();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const rotate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api(
        `/users/me/clients/${encodeURIComponent(slug)}/rotate-key`,
        { method: 'POST' },
      );
      if (!res.ok) return setError(await readApiError(res));
      const body = (await res.json()) as { clientKey: string };
      setConfirming(false);
      setNewKey(body.clientKey);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Rotate key
        </Button>
      </div>

      {confirming && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Rotate the key of {clientName}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-2 text-2">
                  <p>
                    Rotating issues a new private key for your application. The
                    key you have now <strong>stops working immediately</strong>.
                  </p>
                  <ul className="list-disc pl-5">
                    <li>
                      Until you put the new key in your application&apos;s
                      server settings and restart it, Hypha will reject its
                      requests.
                    </li>
                    <li>The new key is shown once; it cannot be recovered.</li>
                  </ul>
                  {error && (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                colorVariant="error"
                disabled={busy}
                onClick={() => void rotate()}
              >
                {busy ? 'Rotating…' : 'Rotate and show new key'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {newKey && (
        <KeyRevealDialog
          clientName={clientName}
          clientKey={newKey}
          onDone={() => {
            setNewKey(null);
            onRotated();
          }}
        />
      )}
    </>
  );
}
