# Phase 0 runbook — Voice and video call (Matrix) — **IMPLEMENTED**

This document satisfies **Phase 0** of [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md): prerequisites, environment checks, `matrix-js-sdk` version guard, and CSP / media notes for later recording work.

---

## 0.1 Homeserver VoIP / TURN checklist

**Owner:** whoever operates the Matrix homeserver used by Hypha (staging + production).

**Full operator steps (Synapse + coturn, curl checks, QA):** [matrix-voip-turn-server-setup.md](./matrix-voip-turn-server-setup.md).

Use the table below and record **server name**, **date**, and **result** in your deployment notes or ticket.

| Check | How | Pass criteria |
|-------|-----|----------------|
| **Client-server API** | `GET /_matrix/client/versions` on the homeserver base URL | `200` and non-empty `versions` |
| **VoIP / group calls** | Log in with a test user; from devtools or a test script call `client.getVersions()` / verify `waitUntilRoomReadyForGroupCalls` on a test room (Phase 1+) | No hard failure; HS advertises required features per your matrix-js-sdk version |
| **TURN / ICE** | After `client.startClient()`, `client.getTurnServers()` (or allow SDK to fetch) | Returns at least one usable ICE server **or** your org documents use of `forceTURN` + known-good TURN only |
| **E2E group call signaling** | (Post–Phase-1) Create/join `GroupCall` in a test room | Signaling path works; media can be blocked by missing perms in headless tests |

**Note:** Exact version strings depend on the server (Synapse, Dendrite, etc.). Keep a **one-line** “HS version + build” in the runbook when this checklist is run.

**Staging two-browser test (0.2):** When calling UI exists, two users in the **same Space (Matrix room)** start/join a call; confirm **two-way audio** (and video if enabled). For **TURN / relay** simulation, use a client flag or environment (e.g. `forceTURN: true` in a dev-only `createClient` override) as described in the implementation spec.

---

## 0.2 `matrix-js-sdk` version lock (automated)

**Policy:** All packages that depend on `matrix-js-sdk` MUST use **`^40.0.0`**. **Do not** upgrade to **v41+** in Next.js until the monorepo explicitly supports it (see `.agents/references/domain/hypha-matrix-mapping.md`).

**Enforcement:**

- **Script:** `scripts/check-matrix-js-sdk-version.mjs` — run from repo root; exits **0** only if the **resolved** `matrix-js-sdk` is **40.x** (matches `^40.0.0` lockfile resolution).
- **npm script:** `pnpm run check:matrix-sdk` (root `package.json`).

**CI:** The root `pnpm run lint` script runs `check:matrix-sdk` first, so any workflow that uses the monorepo lint task enforces the version policy.

---

## 0.3 Content Security Policy and media (0.4)

**Current state:** The web app’s `next.config.ts` sets **`X-Frame-Options: DENY`** for non-API routes. There is **no** tight `Content-Security-Policy` on HTML responses that would block `getUserMedia` (which is not governed by CSP in the same way as `connect-src`).

| Concern | Guidance |
|---------|----------|
| **`getUserMedia` / `getDisplayMedia`** | Requires **secure context** (HTTPS or localhost). No extra CSP directive is required for basic camera/mic in modern browsers. |
| **ICE / TURN** | WebRTC may connect to **TURN** hostnames; those are selected at runtime. If a **strict CSP** is added later, ensure **`connect-src`** allows TURN/STUN hosts used by the homeserver. |
| **Recording / playback (Phase 6)** | When **media** is stored on a **separate origin** (CDN, S3, signed URLs), add **`connect-src`**, **`media-src`**, and/or **`img-src`** for those origins and document them here. |
| **Workers** | If future code uses **AudioWorklet** or similar, add any required **`worker-src`** in the same pass. |

**Sign-off:** Product/security should re-read this section when **CSP** is tightened repo-wide or when **recording** domains are introduced.

---

## 0.4 Completion

| Step | Status |
|------|--------|
| 0.1 Runbook for HS / TURN | **Documented** (this file) — operators fill checklist per environment |
| 0.2 Two-browser / TURN | **Procedure** above — full execution after Phase 1+ UI |
| 0.3 `matrix-js-sdk@^40` | **Enforced** via `pnpm run check:matrix-sdk` + lockfile `40.2.0` |
| 0.4 CSP / media | **Documented** (this file) + comment in `apps/web/next.config.ts` |

---

## References

- [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md)
- [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md)
- [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md)
