### Next.js 15 App Router

#### Architecture

- **App Router** with `[lang]` dynamic segment for i18n (en/de, prefix-based routing)
- **React Server Components** by default — client components opt in with `'use client'`
- **Server Actions** via `'use server'` directive in `@hypha-platform/core` action files
- **Parallel Routes** for space detail pages: `@aside/` (notification centre) and `@tab/` (overview, agreements, members, treasury)
- **Middleware chain** via `composeMiddleware()` — i18n routing + CSP headers

#### Route Structure

```
app/[lang]/
  network/           — Explore all spaces
  my-spaces/         — Authenticated user's spaces
  profile/[personSlug]/ — Person profiles
  dho/[id]/          — Space detail with parallel routes (@aside, @tab)
app/api/v1/          — REST endpoints for client-side data fetching
app/(mobile)/signin/ — Mobile sign-in flow
```

#### Key Patterns

- `revalidatePath()` for cache invalidation after mutations
- Explicit `./server` exports on packages for RSC-only code
- Root layout nests: `AuthProvider > ThemeProvider > EvmProvider > NotificationSubscriber`
- Redirects: `/` -> `/en/network`, `/[lang]` -> `/[lang]/network`
- Images: remote patterns from `NEXT_PUBLIC_IMAGE_HOSTS`, optional `unoptimized` mode
