# Matrix homeserver VoIP / TURN — operator setup

**Audience:** whoever runs Hypha’s Matrix homeserver (staging + production).  
**Clients:** Hypha Web uses **`matrix-js-sdk`** and expects the standard Matrix **VoIP REST API** and ICE servers — see [voice-video-call-phase-0-runbook.md](./voice-video-call-phase-0-runbook.md) §0.1.

This document complements the **frontend** knobs in `packages/core/src/matrix/client/matrix-webrtc-env.ts` (`NEXT_PUBLIC_MATRIX_WEBRTC_*`). Those only tune **browser** behavior after the homeserver returns valid ICE servers; they **cannot** replace TURN **infrastructure**.

---

## Roles at a glance

| Perspective | Responsibility here |
|-------------|----------------------|
| **Matrix / SDK** | `MatrixClient.checkTurnServers()` → **`GET /_matrix/client/v3/voip/turnServer`** (authenticated). Returned `uris` become `RTCPeerConnection` `iceServers`. Missing or empty `uris` ⇒ most **NAT** deployments get **no reliable media**. |
| **Full-stack / Next** | App must be **HTTPS** (or localhost) for **`getUserMedia`**. If you add a strict **CSP**, extend **`connect-src`** for your TURN/STUN hostnames (see Phase 0 runbook §0.3). Env `NEXT_PUBLIC_MATRIX_WEBRTC_*` maps to `createClient()` (e.g. `forceTURN`, fallback STUN). |
| **UX** | Users see “connecting forever” / stall banners when **ICE fails** — indistinguishable from bugs without server-side verification. Clear copy should mention network/TURN when support knows HS is misconfigured. |
| **QA** | Verify **`/voip/turnServer`** returns **`uris`** for a real user token; run **two browsers / two accounts** on **different networks** or force relay (`NEXT_PUBLIC_MATRIX_WEBRTC_FORCE_TURN=true` in preview) to prove TURN path. |

---

## 1. What must be true on the server

1. **Homeserver exposes VoIP credentials API**  
   Clients call (Matrix spec):  
   **`GET https://<HS>/_matrix/client/v3/voip/turnServer`**  
   With a valid **`Authorization: Bearer <access_token>`**.

   Successful response shape (conceptually): **`uris`**, **`username`**, **`password`**, **`ttl`** (synapse fills these from its TURN integration).

2. **A working TURN server** (typically **coturn**) reachable from browsers on the **public internet**, with UDP (and often TCP/TLS for restrictive networks).

3. **Synapse ↔ coturn authentication** aligned (usually **shared secret** (`use-auth-secret` on coturn, `turn_shared_secret` in Synapse)), so Synapse can mint **temporary** TURN passwords.

Exact YAML keys evolve with Synapse releases — always verify against **[Synapse VoIP / TURN documentation](https://matrix-org.github.io/synapse/latest/turn-howto.html)** for your installed version.

---

## 2. Recommended deployment shape

### 2.1 Coturn (TURN/STUN relay)

- Run **coturn** on a host with a **stable DNS name** and **public IP**.
- Open firewall/security groups for:
  - **UDP** on your TURN ports (default often **3478**, plus relay port range you configure).
  - **TCP** **3478** (and **5349** if using TLS TURN).
  - **Relay port range** (e.g. **49152–65535** UDP) as documented in coturn config — this is where media often flows.
- Configure **`realm`**, **`listening-ip=0.0.0.0`** (bind all interfaces — omitting this often leaves coturn on loopback only), **`external-ip`** (if behind NAT), and **`use-auth-secret`** + **`static-auth-secret`** matching the homeserver TURN shared secret.
- Example file: [docs/operations/coturn.example.conf](../operations/coturn.example.conf).

### 2.2 Synapse

In **`homeserver.yaml`** (names may vary slightly by version):

- **`turn_uris`**: list of `turn:` / `turns:` URIs pointing at your coturn (must match what browsers can resolve and reach).
- **`turn_shared_secret`**: same secret as coturn `static-auth-secret` when using short-lived credentials.
- Optionally tune **`turn_user_lifetime`** (seconds).

After editing, **restart Synapse**.

### 2.3 Dendrite

In **`dendrite.yaml`**, configure TURN under **`client_api.turn`**:

```yaml
client_api:
  turn:
    turn_user_lifetime: "24h"
    turn_uris:
      - "turn:turn.example.org:3478?transport=udp"
      - "turn:turn.example.org:3478?transport=tcp"
    turn_shared_secret: "<same-secret-as-coturn>"
    turn_username: ""
    turn_password: ""
```

After editing, **restart Dendrite**. Example fragment: [docs/operations/dendrite-turn.example.yaml](../operations/dendrite-turn.example.yaml).

### 2.4 Permissions

Ensure Matrix users who should call are **allowed** to request TURN credentials (Synapse historically tied this to settings like allowing VoIP; check current Synapse docs for **guest / restricted** accounts).

---

## 3. Verification (before blaming the web app)

### 3.1 API returns ICE servers

With a **real user access token** (same HS Hypha uses in `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`):

```bash
curl -sS -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "https://<HOMESERVER>/_matrix/client/v3/voip/turnServer" | jq .
```

**Pass:** JSON includes non-empty **`uris`** and credential fields suitable for WebRTC.

**Fail:** empty **`uris`**, **403**, or errors ⇒ fix Synapse/coturn **before** frontend debugging.

### 3.2 Browser / SDK path

After login in Hypha (devtools console, filter **`hypha.group_call`** if telemetry is enabled):

- **`turnCredsOk`** / **`iceHasTurn`** in **`turn_probe`** events (when implemented in your build) — or inspect **`matrix-js-sdk`** logs for **“failed to get TURN credentials”**.

### 3.3 Two-party QA

1. Two **different** users, **same room**, start/join call.
2. Prefer **two networks** (e.g. LTE + home Wi‑Fi) or set **`NEXT_PUBLIC_MATRIX_WEBRTC_FORCE_TURN=true`** on a preview build to **force relay** and prove TURN.

---

## 4. Hypha Web client (reference only)

- **`MatrixProvider`** → `createClient({ disableVoip: false, … })` — VoIP **enabled**.
- **`apps/web/.env.template`** — Matrix homeserver, registration secrets, optional **`NEXT_PUBLIC_MATRIX_TURN_CONNECT_SOURCES`** (CSP when TURN host ≠ homeserver), and **`NEXT_PUBLIC_MATRIX_WEBRTC_*`** knobs.
- Production **CSP** (`apps/web/src/middleware.ts`) includes **`NEXT_PUBLIC_MATRIX_HOMESERVER_URL`** and any **`NEXT_PUBLIC_MATRIX_TURN_CONNECT_SOURCES`** in **`connect-src`**.
- **`NEXT_PUBLIC_MATRIX_WEBRTC_FORCE_TURN`**, **`NEXT_PUBLIC_MATRIX_WEBRTC_FALLBACK_ICE_ALLOWED`**, **`NEXT_PUBLIC_MATRIX_WEBRTC_ICE_POOL_SIZE`** — optional **browser** tuning; **not** a substitute for server TURN.

---

## 5. References

- [Synapse TURN how-to](https://matrix-org.github.io/synapse/latest/turn-howto.html)
- [Matrix Client-Server API — `/voip/turnServer`](https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3voipturnserver)
- [voice-video-call-phase-0-runbook.md](./voice-video-call-phase-0-runbook.md) — checklist table
- [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md) — SDK options overview
