# Common Security Fix Patterns

## XSS — dangerouslySetInnerHTML

**Bad:**
```tsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Fix:** Sanitize with DOMPurify:
```tsx
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

## XSS — href with user input

**Bad:**
```tsx
<a href={userUrl}>Link</a>
```

**Fix:** Validate protocol:
```tsx
const safeUrl = /^https?:\/\//.test(userUrl) ? userUrl : '#';
<a href={safeUrl}>Link</a>
```

## Injection — Command Execution

**Bad:**
```ts
exec(`convert ${filename} output.png`);
```

**Fix:** Use array form:
```ts
execFile('convert', [filename, 'output.png']);
```

## Secrets — Environment Variables

**Bad:**
```ts
const API_KEY = "sk-abc123...";
```

**Fix:**
```ts
const API_KEY = process.env.API_KEY;
// Validate at startup
if (!API_KEY) throw new Error('API_KEY required');
```

Ensure `.env` is in `.gitignore`. For client-side Next.js, only `NEXT_PUBLIC_` vars are exposed — never put secrets there.

## CSRF — SameSite Cookies

**Fix:** Set cookie attributes:
```ts
res.setHeader('Set-Cookie', [
  `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
]);
```

## Auth — Missing Route Protection

**Bad:** API route without auth check.

**Fix (Next.js middleware):**
```ts
export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session && request.nextUrl.pathname.startsWith('/api/protected')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

## CORS — Overly Permissive

**Bad:**
```ts
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Fix:**
```ts
const allowedOrigins = ['https://app.example.com'];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

## Dependencies — Audit Fix

```bash
pnpm audit --fix          # Auto-fix where possible
pnpm audit --production   # Check only production deps
pnpm why <vulnerable-pkg> # Find why it's included
```
