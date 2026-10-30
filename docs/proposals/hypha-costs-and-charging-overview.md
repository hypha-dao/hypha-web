# Hypha costs and how we could charge

**Status:** short overview (not a spec). No dollar amounts — this repo has no live cost figures.

Longer charging options and accounting: [hypha-network-charging-models.md](./hypha-network-charging-models.md).

---

## 1. What is currently incurring cost for us

These are Hypha / platform cost drivers visible in the repo and ops docs. Spend is **unknown** unless we say otherwise.

### App hosting and compute

- **Vercel** runs the Next.js app (`apps/web`), preview deploys, cron, and feature flags.
- **API** (`apps/api`, Fastify) is a second process if we deploy it.
- **Neon PostgreSQL** is the product database (`storage-postgres`).
- **Unknown:** plan size, bandwidth, cron volume.

### Auth

- **Privy** signs people in and issues wallets. Cost usually follows monthly active users.
- **Unknown:** our Privy plan.

### Human chat, calls, and Matrix

- We run a **Matrix homeserver** (Dendrite) and **TURN (coturn)** on a **Hostinger VPS** (`docs/operations/matrix-turn-hostinger-runbook.md`). That is always-on compute and bandwidth for messages, media, and call relay.
- Chat files live on the **homeserver content repo**, not Neon (`docs/architecture/documents-and-media-overview.md`).
- **LiveKit** is wired for some call work (`LIVEKIT_*`, optional flag).
- **Unknown:** whether LiveKit is billed in production, and minutes / GB.

### File storage (app side)

- Proposal and profile uploads go through **Uploadthing** (hosts in CSP: `uploadthing.com`, `utfs.io`).
- Call recordings are specified as **object storage** (ADR 0001).
- **Unknown:** current GB stored.

### AI

- **OpenRouter** powers Hypha AI chat (`packages/chat-server`). Usage comes back on the stream but is **not stored**.
- **OpenAI Realtime** powers onboarding voice when that flag is on.
- Both scale with tokens or session minutes.
- **Unknown:** monthly spend.

### Notifications

- **OneSignal** sends push and email.
- **Unknown:** plan and volume.

### Chain reads and webhooks

- **Alchemy** (API + signed webhooks) and Base RPC keep spaces and proposals in sync.
- Users already pay their own **gas**.
- **Unknown:** Alchemy request volume.

### Banking rails (not Hypha SaaS)

- **Bridge** is KYB and fiat rails for space / person treasuries (ADR 0002). That is banking, not a Hypha subscription.
- **Unknown:** who pays Bridge fees today.

### Other (small or gated)

- **Nominatim** for the network map (when enabled).
- **Google Drive** picker uses Google quotas; files stay in the user’s Drive.
- Hypha Energy telemetry (`ENERGY_DB_*`, `ENERGY_API_*`) is a **product-specific** path, not a cost every space incurs.

We have **no Stripe** (or similar) for SaaS. There is no cost ledger in Postgres.

---

## 2. How we could charge a user or a space

Today we already charge **per space, on-chain** (USDC or HYPHA for months of access). Card billing does not exist yet.

| If we want to recover… | Charge whom | How |
|---|---|---|
| Baseline app + DB + Matrix room + TURN | The **space** | Keep a **per-space** fee (crypto now; **card sub** later). One payer; members get access. |
| Extra people (Privy, OneSignal, Matrix accounts) | **User / seat** in that space | Seat pack on top of the space fee, if large spaces get expensive. |
| AI chat / voice | Space, or the person who used it | **Usage** (tokens / minutes) once we persist OpenRouter / OpenAI usage. Or include a quota in the space plan. |
| Uploadthing + recordings + Matrix media | The space | Storage quota on the space plan, or GB overage later. We have no byte meter yet. |
| LiveKit / long calls | The space | Call minutes — only if LiveKit is actually on in production. |
| Alchemy / RPC | The space (folded in) | Do **not** bill per on-chain action; users already pay gas. Fold into the space fee. |
| Bridge banking | Not Hypha SaaS | Leave as banking fees. Do not mix into the platform sub. |

**Member split:** one card (or one crypto payment) can later be split among members for reporting. High friction. Not needed to start.

**Personal sub** (a person pays, then joins many spaces): messy with Hypha’s “space is active” model. Skip for now.

### Light recommendation

1. Keep **one fee per space** (crypto now; add a **card** as a second way to pay the same thing).
2. Treat **AI** as the first usage add-on when we start recording it.
3. Add **seats** only if a flat space fee is unfair for big memberships.
4. Do not charge per chat message or per proposal.

For models, card lifecycle, and accounting, see [hypha-network-charging-models.md](./hypha-network-charging-models.md).
