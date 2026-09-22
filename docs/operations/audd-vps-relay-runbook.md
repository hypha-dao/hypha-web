# AUDD Gateway VPS relay — Hostinger runbook

Blind TCP/CONNECT relay giving Vercel (no static outbound IP) a stable, AUDD-allowlisted egress IP
for the AUDD Gateway `/customer/*` API (#2474 WS8), without ever putting the mTLS client cert on
the VPS. Design confirmed in ticket #2362 decision D1; full architecture rationale in the drafted
spec (`git show d8e206e9b:docs/requirements/audd-digital-integration-spec.md` — never merged to
main, kept as history). Same VPS as the Matrix/TURN/LiveKit stack
(`docs/operations/matrix-turn-hostinger-runbook.md`) but a completely separate, native service —
not part of that Docker Compose stack.

## 1. What "healthy" looks like

- `systemctl status tinyproxy` → `active (running)`.
- `ss -tlnp | grep 28443` → listening on `0.0.0.0:28443`.
- A `CONNECT` to `api.sandbox.audd.digital:443` through the relay, with the right `BasicAuth`
  credentials, returns `200 Connection established`.
- A `CONNECT` to anything else (e.g. `example.com:443`) returns `403 Filtered`.
- No credentials at all → `407 Proxy Authentication Required`.

## 2. Architecture (why this shape)

```
Vercel (apps/web / apps/api, dynamic IP)
   - holds: AUDD mTLS client cert + key, AUDD_GATEWAY_API_KEY
   - packages/core/.../providers/audd/audd-client.ts — node:https + HttpsProxyAgent
        │  CONNECT tunnel to the relay (BasicAuth in the proxy URL)
        ▼
AUDD relay — tinyproxy on srv1294735.hstgr.cloud:28443 (this runbook)
   - blind TCP forward, scoped to api.sandbox.audd.digital only — never terminates TLS
   - cannot read or complete the mTLS handshake (holds no cert) — a compromised relay alone
     can't impersonate Hypha to AUDD
        │  mTLS (same connection, untouched by the relay)
        ▼
AUDD Gateway API (api.sandbox.audd.digital)
```

**Why not Caddy** (already running on this box): `reverse_proxy` terminates TLS at the HTTP layer
to route by host/path — that would force the client cert onto the VPS, the exact thing this design
avoids. tinyproxy just forwards raw bytes after a `CONNECT`, so it never sees the TLS/mTLS
handshake at all.

**Why `tinyproxy`'s own `BasicAuth`, not an IP allowlist:** Vercel has no static outbound IP (that's
the whole reason this relay exists), so the relay can't gate by source IP the way AUDD gates *us*.
`BasicAuth` is a second, independent secret from the mTLS cert/key — a leaked Vercel env var
shouldn't compromise both layers at once.

## 3. SSH onto the VPS

```bash
ssh root@srv1294735.hstgr.cloud
```

## 4. Current config (as deployed 2026-09-22)

- **Service:** `tinyproxy` (native `apt` package, Ubuntu 24.04 — not Dockerized, unlike the
  Matrix/LiveKit stack under `/srv/matrix/`)
- **Port:** `28443` (chosen clear of everything else on the box: `22, 53, 80, 443, 7880, 7881,
  8008, 8448`)
- **Config file:** `/etc/tinyproxy/tinyproxy.conf` (stock original backed up to
  `/etc/tinyproxy/tinyproxy.conf.orig`)
- **Filter file:** `/etc/tinyproxy/audd-allowed-hosts` — one line,
  `^api\.sandbox\.audd\.digital$`. Add a second line for the production host once AUDD provisions
  one; don't widen this to a wildcard.
- **Auth:** `BasicAuth hypha_audd <relay-secret>` — the secret is a random value from
  `openssl rand -base64 24`, **not** derived from or stored alongside the AUDD mTLS cert/key.
  Recorded in [wherever the mTLS cert/key already live — Ger's secure storage / Vaultwarden per
  #2362 D1], not in this repo, not in chat.
- **Firewall:** `ufw` is **inactive** on this box (traffic control is whatever's listening +
  Hostinger's panel-level firewall). `28443/tcp` was opened in the **Hostinger panel firewall**
  (source `0.0.0.0/0` — can't restrict by source IP here either, same reason as above).

```ini
# /etc/tinyproxy/tinyproxy.conf
User tinyproxy
Group tinyproxy
Port 28443
Listen 0.0.0.0
Timeout 600
DefaultErrorFile "/usr/share/tinyproxy/default.html"
StatFile "/usr/share/tinyproxy/stats.html"
Logfile "/var/log/tinyproxy/tinyproxy.log"
LogLevel Info
PidFile "/run/tinyproxy/tinyproxy.pid"
MaxClients 20
BasicAuth hypha_audd <relay-secret>
ConnectPort 443
Filter "/etc/tinyproxy/audd-allowed-hosts"
FilterDefaultDeny Yes
FilterExtended Yes
DisableViaHeader Yes
```

## 5. Deploy from scratch (if the box is rebuilt)

```bash
apt-get update && apt-get install -y tinyproxy

RELAY_PASSWORD=$(openssl rand -base64 24)
echo "SAVE THIS — goes into the Vercel AUDD_GATEWAY_HTTPS_PROXY env var:"
echo "  AUDD_GATEWAY_HTTPS_PROXY=http://hypha_audd:${RELAY_PASSWORD}@srv1294735.hstgr.cloud:28443"

cat > /etc/tinyproxy/audd-allowed-hosts <<'EOF'
^api\.sandbox\.audd\.digital$
EOF

cp /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf.orig

cat > /etc/tinyproxy/tinyproxy.conf <<EOF
User tinyproxy
Group tinyproxy
Port 28443
Listen 0.0.0.0
Timeout 600
DefaultErrorFile "/usr/share/tinyproxy/default.html"
StatFile "/usr/share/tinyproxy/stats.html"
Logfile "/var/log/tinyproxy/tinyproxy.log"
LogLevel Info
PidFile "/run/tinyproxy/tinyproxy.pid"
MaxClients 20
BasicAuth hypha_audd ${RELAY_PASSWORD}
ConnectPort 443
Filter "/etc/tinyproxy/audd-allowed-hosts"
FilterDefaultDeny Yes
FilterExtended Yes
DisableViaHeader Yes
EOF

systemctl enable --now tinyproxy
systemctl status tinyproxy --no-pager
ss -tlnp | grep 28443
```

Then open `28443/tcp` (source `0.0.0.0/0`) in the **Hostinger panel firewall** — see §7, this is
the step most likely to be forgotten (the service comes up fine locally without it; only external
reachability fails, silently, as a connect timeout).

## 6. Verify (copy-paste)

**From the VPS itself** (isolates the relay's own logic from any network/firewall question):

```bash
RELAY_PASSWORD="<the secret>"

echo "--- 1) no credentials -> expect 407 ---"
curl -sv --proxy http://127.0.0.1:28443 https://api.sandbox.audd.digital/ 2>&1 | grep -E "< HTTP|407"

echo "--- 2) allowed host -> expect CONNECT 200 ---"
curl -sv --proxy "http://hypha_audd:${RELAY_PASSWORD}@127.0.0.1:28443" https://api.sandbox.audd.digital/ 2>&1 | grep -E "CONNECT|Connection established|< HTTP"

echo "--- 3) disallowed host -> expect 403 Filtered ---"
curl -sv --proxy "http://hypha_audd:${RELAY_PASSWORD}@127.0.0.1:28443" https://example.com/ 2>&1 | grep -E "CONNECT|< HTTP|403"
```

**From outside** (confirms the Hostinger panel firewall rule is actually live):

```bash
RELAY_PASSWORD="<the secret>"
curl -sv --proxy "http://hypha_audd:${RELAY_PASSWORD}@srv1294735.hstgr.cloud:28443" https://api.sandbox.audd.digital/ 2>&1 | grep -E "CONNECT|Connection established|< HTTP|Failed to connect|timed out"
```

`CONNECT tunnel established, response 200` = healthy end to end. `Failed to connect ... after
21089 ms` (a hang, not an immediate refusal) with the VPS-local test passing = the Hostinger panel
firewall rule isn't open yet — that exact failure mode is what we hit deploying this the first time
(2026-09-22).

## 7. Hostinger panel firewall

`ufw` is inactive on this box — port exposure is controlled by Hostinger's **panel-level**
firewall, not anything visible over SSH. To open the relay port:

1. Hostinger control panel → this VPS → **Firewall**.
2. Add an inbound rule: **TCP**, port **`28443`**, source **Anywhere / `0.0.0.0/0`**.
3. Apply — takes about a minute to propagate. Re-run the external `curl` test in §6.

## 8. Vercel-side wiring

Single env var, proxy URL with the secret embedded (not split into a separate variable — see §2
on why the secret lives only in this one place):

```
AUDD_GATEWAY_HTTPS_PROXY=http://hypha_audd:<relay-secret>@srv1294735.hstgr.cloud:28443
```

Consumed by `packages/core/src/banking/server/providers/audd/audd-client.ts` via `HttpsProxyAgent`
— when set, every `/customer/*` call tunnels through the relay with the mTLS cert/key attached to
the *destination* TLS handshake (to AUDD), which the proxy never sees. Unset ⇒ the client connects
to AUDD directly (only works from an already-allowlisted egress IP — the VPS itself, or the local
SSH-tunnel dev workaround, #2362 D3 — not from Vercel).

## 9. Troubleshooting

**Config won't parse / `tinyproxy -d -c ... ` errors `Syntax error on line N`:** almost always a
shell-variable interpolation problem in the heredoc (e.g. `${RELAY_PASSWORD}` was empty because the
SSH session was reset between generating it and writing the config, leaving a bare `BasicAuth
hypha_audd` with nothing after it). Check with `sed -n '<N>p' /etc/tinyproxy/tinyproxy.conf`, fix
directly with `sed -i "s|^BasicAuth .*|BasicAuth hypha_audd <password>|" ...`, don't re-run the
whole heredoc blind.

**Leftover manual test process still bound to the port before starting the systemd service:**
`ps aux | grep tinypro[x]y` — a `kill %N` in one shell won't reach a background job started in a
different SSH session (job numbers are per-shell). Kill by PID directly, confirm `ss -tlnp | grep
28443` is empty, then `systemctl enable --now tinyproxy`.

**External `curl` hangs/times out but the VPS-local test passes:** Hostinger panel firewall rule
missing — see §7. A *reachable-but-closed* port (relay down, or a host-level `ufw` block) usually
fails fast with `Connection refused`; a silent hang/timeout across a cloud provider's edge is the
signature of a firewall drop upstream of the box.

**Logs:** `/var/log/tinyproxy/tinyproxy.log` (or `journalctl -u tinyproxy -f`).

**Rollback:** `systemctl stop tinyproxy && systemctl disable tinyproxy`, restore
`/etc/tinyproxy/tinyproxy.conf.orig` if needed. Doesn't touch Caddy or the Matrix/LiveKit stack —
fully isolated.

## 10. Rotating the relay secret

1. Generate a new one: `openssl rand -base64 24`.
2. `sed -i "s|^BasicAuth .*|BasicAuth hypha_audd <new-secret>|" /etc/tinyproxy/tinyproxy.conf`
3. `systemctl restart tinyproxy`
4. Update `AUDD_GATEWAY_HTTPS_PROXY` in Vercel (all environments using it) with the new secret.
5. Re-run the §6 verification.

## 11. Checklist (operator sign-off)

- [ ] `systemctl status tinyproxy` → `active (running)`
- [ ] `/etc/tinyproxy/audd-allowed-hosts` contains only the intended AUDD host(s) — no wildcards
- [ ] VPS-local §6 tests: 407 / 200 / 403 as expected
- [ ] Hostinger panel firewall: `28443/tcp` open, `0.0.0.0/0`
- [ ] External §6 test: `CONNECT tunnel established, response 200`
- [ ] Relay secret saved in secure storage, **not** alongside the mTLS cert/key, **not** in git
- [ ] `AUDD_GATEWAY_HTTPS_PROXY` set in the relevant Vercel environment(s)
