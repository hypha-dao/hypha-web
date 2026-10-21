'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CLIENT_LOGO_MAX_BYTES,
  CLIENT_LOGO_REJECTION_MESSAGE,
  INTEGRATION_CLIENT_SCOPES,
} from '@hypha-platform/core/client';
import { Button, Input, Label, Textarea } from '@hypha-platform/ui';
import { SCOPE_LABELS, readApiError, useDeveloperApi } from '../_lib/api';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | {
      kind: 'done';
      slug: string;
      hadLogo: boolean;
      logoMessage: string | null;
    };

/** The registration form: the one registration route, then the logo upload. */
export function ClientRegistrationForm() {
  const { lang } = useParams<{ lang: string }>();
  const api = useDeveloperApi();
  const [scopes, setScopes] = useState<string[]>([
    ...INTEGRATION_CLIENT_SCOPES,
  ]);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  useEffect(() => {
    if (!logo) return setLogoPreview(null);
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const pickLogo = (file: File | null) => {
    setLogoError(null);
    if (!file) return setLogo(null);
    // Quick feedback only: the server judges the real content.
    if (!LOGO_TYPES.includes(file.type)) {
      setLogo(null);
      return setLogoError(CLIENT_LOGO_REJECTION_MESSAGE.unsupported_type);
    }
    if (file.size > CLIENT_LOGO_MAX_BYTES) {
      setLogo(null);
      return setLogoError(CLIENT_LOGO_REJECTION_MESSAGE.too_large);
    }
    setLogo(file);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const origins = text('origins')
      .split(/\s*\n\s*/)
      .filter(Boolean);
    if (scopes.length === 0) {
      return setOutcome({ kind: 'error', message: 'Pick at least one scope.' });
    }

    setBusy(true);
    setOutcome({ kind: 'idle' });
    try {
      const res = await api('/clients/requests', {
        method: 'POST',
        body: JSON.stringify({
          name: text('name'),
          description: text('description') || undefined,
          // Blank: the server uses the account email.
          ...(text('contactEmail')
            ? { contactEmail: text('contactEmail') }
            : {}),
          allowedOrigins: origins,
          scopes,
        }),
      });
      if (!res.ok) {
        return setOutcome({ kind: 'error', message: await readApiError(res) });
      }
      const { slug } = (await res.json()) as { slug: string };

      let logoMessage: string | null = null;
      if (logo) {
        const body = new FormData();
        body.set('logo', logo);
        const logoRes = await api(
          `/users/me/clients/${encodeURIComponent(slug)}/logo`,
          { method: 'POST', body },
        );
        if (!logoRes.ok) {
          logoMessage = `The request was recorded, but the logo was not accepted: ${await readApiError(
            logoRes,
          )}. You can add it again from My clients.`;
        }
      }
      setOutcome({ kind: 'done', slug, hadLogo: !!logo, logoMessage });
    } catch {
      setOutcome({ kind: 'error', message: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  };

  if (outcome.kind === 'done') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-3 font-semibold text-foreground">
          Request sent: {outcome.slug}
        </p>
        <p className="text-2 text-muted-foreground">
          It is pending review. When a reviewer approves it, they pass the key
          to you securely.
          {outcome.hadLogo &&
            !outcome.logoMessage &&
            ' Your logo is reviewed together with the request and appears only after approval.'}
        </p>
        {outcome.logoMessage && (
          <p className="text-2 text-destructive">{outcome.logoMessage}</p>
        )}
        <div>
          <Link href={`/${lang}/developers/clients`}>
            <Button>See my clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-5">
      <p className="text-2 text-muted-foreground">
        The register is vetted: every request is reviewed by the Hypha team
        before a key is issued. This is not self-service for unknown
        applications.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Application name</Label>
        <Input id="name" name="name" required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">What it does</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={1000}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          placeholder="Leave empty to use your account email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="origins">Allowed origins (one per line)</Label>
        <Textarea
          id="origins"
          name="origins"
          rows={3}
          placeholder="https://app.example.com"
        />
        <p className="text-1 text-muted-foreground">
          Where your application opens Hypha from, such as
          https://app.example.com (no path). They must match the allowed origins
          in your identity-provider dashboard.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-2 font-medium text-foreground">
          Scopes
        </legend>
        {INTEGRATION_CLIENT_SCOPES.map((scope) => (
          <label key={scope} className="flex items-start gap-2 text-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={scopes.includes(scope)}
              onChange={(e) =>
                setScopes((current) =>
                  e.target.checked
                    ? [...current, scope]
                    : current.filter((s) => s !== scope),
                )
              }
            />
            <span>
              <code className="text-foreground">{scope}</code>
              <span className="block text-1 text-muted-foreground">
                {SCOPE_LABELS[scope] ?? ''}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">Logo (optional)</Label>
        <Input
          id="logo"
          type="file"
          accept={LOGO_TYPES.join(',')}
          onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
        />
        <p className="text-1 text-muted-foreground">
          PNG, JPEG or WebP (no SVG), up to 4 MB, roughly square. It is shown at
          about 40 px next to the Hypha mark on the confirmation page, and is
          reviewed before it appears: nobody sees it until the client is
          approved.
        </p>
        {logoError && <p className="text-1 text-destructive">{logoError}</p>}
        {logoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPreview}
            alt="Logo preview"
            width={40}
            height={40}
            className="size-10 object-contain"
          />
        )}
      </div>

      {outcome.kind === 'error' && (
        <p role="alert" className="text-2 text-destructive">
          {outcome.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </form>
  );
}
