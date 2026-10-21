import Link from 'next/link';

type PageProps = { params: Promise<{ lang: string }> };

/** Pages that do not exist yet are shown as such, never as real addresses. */
const PLACEHOLDERS = [
  'Documentation',
  'API reference',
  'Integrator guide',
  'Support',
];

export default async function DevelopersPage({ params }: PageProps) {
  const { lang } = await params;
  const base = `/${lang}/developers`;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-5 font-semibold text-foreground">
        Integrate with Hypha
      </h1>
      <p className="text-2 text-muted-foreground">
        Register your application with Hypha to read data it is allowed to see
        and to let people confirm actions in Hypha from your product. The
        register is vetted: each request is reviewed by the Hypha team before a
        key is issued.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-3 font-semibold text-foreground">Start here</h2>
        <ul className="list-disc pl-5 text-2">
          <li>
            <Link className="underline" href={`${base}/clients/new`}>
              Register a client
            </Link>{' '}
            (sign in with Hypha)
          </li>
          <li>
            <Link className="underline" href={`${base}/clients`}>
              My clients
            </Link>{' '}
            (status, scopes, origins)
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-3 font-semibold text-foreground">Resources</h2>
        <ul className="list-disc pl-5 text-2 text-muted-foreground">
          {PLACEHOLDERS.map((label) => (
            <li key={label}>
              {label} <em>(not yet available)</em>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-3 font-semibold text-foreground">
          Before you go live: identity provider checklist
        </h2>
        <ul className="list-disc pl-5 text-2 text-muted-foreground">
          <li>
            The allowed origins in the identity-provider dashboard must match
            the origins you registered here, exactly.
          </li>
          <li>
            Put the client id of that application in your own server environment
            (never in a repository).
          </li>
          <li>
            Keep the client key on your server only; ask for a rotation if it is
            ever exposed.
          </li>
        </ul>
      </section>
    </div>
  );
}
