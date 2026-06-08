# Matrix TURN fix — Hostinger VPS runbook

**Audience:** operator with SSH on the Hypha production Matrix host  
**Homeserver:** `https://srv1294735.hstgr.cloud` (Dendrite)  
**Symptom in Hypha app:** in-call banner — *"Voice, video, and screen share may be unreliable — the Matrix server is not providing TURN relay servers."*  
**Root cause:** Dendrite is not returning usable TURN credentials via `GET /_matrix/client/v3/voip/turnServer`, and/or coturn is misconfigured / unreachable.

Hypha Web (app) cannot fix this in code. Calls work on the same LAN but fail across NAT without working TURN relay.

Related docs:

- [matrix-voip-turn-server-setup.md](../requirements/matrix-voip-turn-server-setup.md)
- [coturn.example.conf](./coturn.example.conf)
- [dendrite-turn.example.yaml](./dendrite-turn.example.yaml)

---

## 1. What “healthy” looks like

When fixed, an **authenticated** request to the homeserver returns non-empty TURN URIs and short-lived credentials:

```bash
curl -sS -H "Authorization: Bearer <MATRIX_ACCESS_TOKEN>" \
  "https://srv1294735.hstgr.cloud/_matrix/client/v3/voip/turnServer" | jq .
```

**Pass example (shape only — values differ per request):**

```json
{
  "uris": [
    "turn:srv1294735.hstgr.cloud:3478?transport=udp",
    "turn:srv1294735.hstgr.cloud:3478?transport=tcp"
  ],
  "username": "…",
  "password": "…",
  "ttl": 86400
}
```

**Fail:** empty `uris`, missing `username`/`password`, HTTP 403/500, or timeout.

From Hypha production (logged-in user Privy JWT):

```bash
curl -sS -H "Authorization: Bearer <PRIVY_JWT>" \
  "https://app.hypha.earth/api/matrix/turn-health" | jq .
```

**Pass:** `"ok": true`, `"turnCredsOk": true`, `"uriCount" >= 1`, `"hasTurnUdp": true` or `"hasTurnTcp": true`.

---

## 2. SSH onto the VPS

```bash
ssh root@srv1294735.hstgr.cloud
# or: ssh <user>@<VPS_IP>
```

Confirm public IP (needed for coturn `external-ip` if behind NAT):

```bash
curl -4 -s ifconfig.me && echo
hostname -f
```

---

## 3. Diagnose (copy-paste)

Run these **before** changing config. Save output for support.

### 3.1 Matrix API up?

```bash
curl -sS -o /dev/null -w "versions HTTP %{http_code}\n" \
  "https://srv1294735.hstgr.cloud/_matrix/client/versions"

curl -sS "https://srv1294735.hstgr.cloud/_matrix/client/v3/voip/turnServer" | jq .
# Expect M_MISSING_TOKEN (401) without auth — proves route exists
```

### 3.2 Is coturn installed and running?

```bash
which turnserver || which coturn
systemctl status coturn 2>/dev/null || systemctl status turnserver 2>/dev/null
ss -ulnp | grep 3478 || netstat -ulnp | grep 3478
ss -tlnp | grep 3478 || true
```

**Red flags:**

- Service `inactive` / `failed`
- Only `127.0.0.1:3478` listening (coturn bound to loopback — add `listening-ip=0.0.0.0`)
- No process on 3478 at all

### 3.3 coturn config

Common paths:

```bash
ls -la /etc/turnserver.conf /etc/coturn/turnserver.conf 2>/dev/null
grep -E '^(listening-port|listening-ip|external-ip|realm|use-auth-secret|static-auth-secret|min-port|max-port)' \
  /etc/turnserver.conf /etc/coturn/turnserver.conf 2>/dev/null
```

**Required settings:**

| Key | Value |
|-----|--------|
| `listening-port` | `3478` |
| `listening-ip` | `0.0.0.0` |
| `use-auth-secret` | present |
| `static-auth-secret` | long random string |
| `realm` | `srv1294735.hstgr.cloud` (or dedicated TURN hostname) |
| `external-ip` | VPS public IPv4 if behind NAT |
| `min-port` / `max-port` | e.g. `49152` / `65535` |

### 3.4 Dendrite TURN config

Find `dendrite.yaml` (path varies by install):

```bash
find /etc /opt /var -name 'dendrite.yaml' 2>/dev/null | head -5
# then:
DENDRITE_YAML=/path/to/dendrite.yaml   # set from find output
grep -A20 'client_api:' "$DENDRITE_YAML" | head -30
grep -A15 'turn:' "$DENDRITE_YAML" || echo "NO turn: block under client_api"
```

**Red flags:**

- No `client_api.turn` section
- Empty `turn_uris: []`
- `turn_shared_secret` missing or **not identical** to coturn `static-auth-secret`

### 3.5 Firewall (Hostinger VPS — often ufw)

```bash
ufw status verbose 2>/dev/null || true
iptables -L INPUT -n -v 2>/dev/null | head -20 || true
```

**Must allow from internet:**

| Protocol | Port(s) | Purpose |
|----------|---------|---------|
| UDP | 3478 | STUN/TURN |
| TCP | 3478 | TURN (TCP fallback) |
| UDP | 49152–65535 | TURN media relay |
| TCP | 5349 | optional TLS TURN |

External probe (from your laptop, not the server):

```bash
nc -zvu -w 3 srv1294735.hstgr.cloud 3478
```

---

## 4. Fix coturn

### 4.1 Install if missing (Debian/Ubuntu)

```bash
apt-get update
apt-get install -y coturn
```

### 4.2 Generate shared secret (once)

```bash
TURN_SECRET="$(openssl rand -hex 32)"
echo "Save this secret for Dendrite turn_shared_secret:"
echo "$TURN_SECRET"
```

### 4.3 Edit `/etc/turnserver.conf`

```bash
cp /etc/turnserver.conf /etc/turnserver.conf.bak.$(date +%Y%m%d)
nano /etc/turnserver.conf
```

Paste/adjust (replace `YOUR_PUBLIC_IP`):

```ini
listening-port=3478
listening-ip=0.0.0.0

fingerprint
use-auth-secret
static-auth-secret=REPLACE_WITH_TURN_SECRET_FROM_STEP_4_2

realm=srv1294735.hstgr.cloud
server-name=srv1294735.hstgr.cloud
external-ip=YOUR_PUBLIC_IP

min-port=49152
max-port=65535

no-multicast-peers
no-loopback-peers
no-cli
simple-log
```

Enable and restart:

```bash
sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
systemctl enable coturn
systemctl restart coturn
systemctl status coturn --no-pager
ss -ulnp | grep 3478
```

---

## 5. Fix Dendrite

### 5.1 Edit `dendrite.yaml`

Under `client_api`, add or replace `turn:` (use **same** `TURN_SECRET` as coturn):

```yaml
client_api:
  turn:
    turn_user_lifetime: "24h"
    turn_uris:
      - "turn:srv1294735.hstgr.cloud:3478?transport=udp"
      - "turn:srv1294735.hstgr.cloud:3478?transport=tcp"
    turn_shared_secret: "REPLACE_WITH_TURN_SECRET_FROM_STEP_4_2"
    turn_username: ""
    turn_password: ""
```

### 5.2 Restart Dendrite

Service name may differ:

```bash
systemctl list-units --type=service | grep -i dendrite
systemctl restart dendrite   # or dendrite-monolith / your unit name
systemctl status dendrite --no-pager
```

---

## 6. Open firewall (ufw example)

```bash
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 49152:65535/udp
# optional TLS TURN:
# ufw allow 5349/tcp
ufw status
```

**Hostinger control panel:** if a cloud firewall exists in hPanel, mirror the same rules there (panel rules can override ufw).

---

## 7. Verify end-to-end

### 7.1 On the server — authenticated Matrix token

Obtain a Matrix access token (from Dendrite admin tools, or register/login via Matrix client API). Then:

```bash
export MATRIX_TOKEN="<access_token>"
curl -sS -H "Authorization: Bearer $MATRIX_TOKEN" \
  "https://srv1294735.hstgr.cloud/_matrix/client/v3/voip/turnServer" | jq .
```

Check: `uris` non-empty, `username` and `password` present.

### 7.2 From Hypha production

1. Log into https://app.hypha.earth  
2. DevTools → Application → copy Privy session / use Network tab `Authorization: Bearer` on an API call  
3. Run:

```bash
curl -sS -H "Authorization: Bearer <PRIVY_JWT>" \
  "https://app.hypha.earth/api/matrix/turn-health" | jq .
```

### 7.3 Live call test

1. Two users, **different networks** (Wi‑Fi + mobile hotspot)  
2. Join voice/video call in Human Chat  
3. **Banner should not appear** (or dismiss and it should not return)  
4. Test mic, camera, screen share for 5–10 minutes  

Browser console (filter `hypha.group_call`): look for `turn_probe` with `turnCredsOk: true`.

---

## 8. Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `turnServer` returns `{}` or empty `uris` | Dendrite `client_api.turn` missing or wrong YAML indentation |
| `uris` present but calls still fail | Firewall blocking UDP 49152–65535; wrong `external-ip` |
| coturn runs but only on 127.0.0.1 | Set `listening-ip=0.0.0.0`, restart coturn |
| 401 on turnServer with valid token | Token from wrong homeserver; clock skew; Dendrite auth issue |
| **429 / M_LIMIT_EXCEEDED** on `turnServer` | Dendrite `client_api.rate_limiting` too strict — raise threshold/cooloff or exempt VoIP; hard-refresh client after fix |
| STUN works, TURN auth fails | `turn_shared_secret` ≠ coturn `static-auth-secret` |
| Banner still shows after server fix | Hard-refresh app; leave and rejoin call; check Hypha `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` points to this host |
| **`CREATE_PERMISSION` → `error 403: Forbidden IP`** in coturn logs (ALLOCATE succeeds) | coturn is blocking peer relay permissions — see §8.1 |

### 8.1 `CREATE_PERMISSION` / `403 Forbidden IP` (calls connect but no media)

**Symptom in `journalctl -u coturn` during a live call:**

```
incoming packet ALLOCATE processed, success
incoming packet CREATE_PERMISSION processed, error 403: Forbidden IP
peer usage: ... rp=0, rb=0, sp=0, sb=0
```

TURN credentials and relay allocation work; **media cannot flow** because coturn refuses to relay between peers.

**On the VPS:**

```bash
grep -E '^(denied-peer-ip|allowed-peer-ip|external-ip|relay-ip|no-loopback-peers)' \
  /etc/turnserver.conf /etc/coturn/turnserver.conf 2>/dev/null
```

**Fix:** edit `/etc/turnserver.conf` — ensure `external-ip` is the VPS public IPv4, remove overly broad `denied-peer-ip` lines, and allow peer permissions:

```ini
external-ip=YOUR_PUBLIC_IP
relay-ip=YOUR_PUBLIC_IP
allowed-peer-ip=0.0.0.0-255.255.255.255
```

Do **not** add `denied-peer-ip=YOUR_PUBLIC_IP`. Restart: `systemctl restart coturn`.

**Verify:** during a call, logs should show `CREATE_PERMISSION processed, success` and non-zero `peer usage`.

### coturn logs

```bash
journalctl -u coturn -n 100 --no-pager
```

### Dendrite logs

```bash
journalctl -u dendrite -n 100 --no-pager
```

### Rate limiting (HTTP 429 on `/voip/turnServer`)

If Safari/Chrome console shows `M_LIMIT_EXCEEDED` on `turnServer`, Dendrite is throttling TURN credential fetches. In `dendrite.yaml` under `client_api.rate_limiting`, consider raising limits for production VoIP (example — tune to your traffic):

```yaml
client_api:
  rate_limiting:
    enabled: true
    threshold: 60
    cooloff_ms: 500
```

Restart Dendrite after changes. Users should hard-refresh Hypha and rejoin the call once rate limits are relaxed.

### Rollback

```bash
cp /etc/turnserver.conf.bak.* /etc/turnserver.conf
systemctl restart coturn
# revert dendrite.yaml from backup, restart dendrite
```

---

## 9. Optional: dedicated TURN hostname

If TURN runs on a different host than Dendrite:

1. DNS: `turn.hypha.earth` → TURN server IP  
2. coturn `realm` / certs on that hostname  
3. Dendrite `turn_uris` use `turn:turn.hypha.earth:3478?...`  
4. Hypha Vercel env: add to `NEXT_PUBLIC_MATRIX_TURN_CONNECT_SOURCES` for CSP `connect-src`  
5. Rebuild/redeploy Hypha Web after CSP env change  

For single-host setup (`srv1294735.hstgr.cloud`), step 4 is usually **not** required.

---

## 10. Checklist (operator sign-off)

- [ ] coturn active, listening on `0.0.0.0:3478` (UDP + TCP)
- [ ] `static-auth-secret` set in coturn
- [ ] `client_api.turn` in Dendrite with matching `turn_shared_secret`
- [ ] `turn_uris` include UDP and TCP transport
- [ ] Firewall allows UDP 3478, TCP 3478, UDP 49152–65535
- [ ] `/voip/turnServer` returns non-empty `uris` + credentials (authenticated)
- [ ] `https://app.hypha.earth/api/matrix/turn-health` → `turnCredsOk: true`
- [ ] Two-network call test passes; Hypha TURN banner gone

---

## 11. Info to send back to Hypha team

After running the runbook, paste (redact secrets):

1. Output of §3.1–3.5 diagnose commands  
2. `curl …/voip/turnServer` JSON (redact `username`/`password`)  
3. `curl …/api/matrix/turn-health` JSON  
4. Whether two-network call test passed  
