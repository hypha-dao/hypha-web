# AUDD Gateway VPS relay — Hostinger runbook

Blind TCP/CONNECT relay giving Vercel (no static outbound IP) a stable, AUDD-allowlisted egress IP
for the AUDD Gateway `/customer/*` API (#2474 WS8), without ever putting the mTLS client cert on
the VPS. Design confirmed in ticket #2362 decision D1; full architecture rationale in the drafted
spec (`git show d8e206e9b:docs/requirements/audd-digital-integration-spec.md` — never merged to
main, kept as history). Same VPS as the Matrix/TURN/LiveKit stack
(`docs/operations/matrix-turn-hostinger-runbook.md`) — tinyproxy and stunnel run as native systemd
services, not part of that Docker Compose stack, but stunnel **reads** (read-only, no writes, no
container interaction) the Matrix stack's Caddy TLS certificate for `srv1294735.hstgr.cloud` from
its Docker volume — see §5 "Why reuse Caddy's cert."

As of 2026-09-23 (#2474 D20 follow-up) the relay's public-facing hop is TLS-wrapped: `stunnel`
terminates TLS on the public port and hands plaintext off to `tinyproxy` on a loopback-only port.
See §2 for why, and §9 for the two real gotchas hit deploying this layer.

## 1. What "healthy" looks like

- `systemctl status audd-relay-stunnel` → `active (running)`.
- `systemctl status tinyproxy` → `active (running)`.
- `ss -tlnp | grep 28443` → `stunnel4` listening on `0.0.0.0:28443` (public).
- `ss -tlnp | grep 28444` → `tinyproxy` listening on `127.0.0.1:28444` (loopback only).
- A `CONNECT` to `api.sandbox.audd.digital:443` through the relay (`https://` proxy scheme, real
  hostname, right `BasicAuth` credentials) returns `200 Connection established`.
- A `CONNECT` to anything else (e.g. `example.com:443`) returns `403 Filtered`.
- No credentials at all → `407 Proxy Authentication Required` (tinyproxy's own check, unchanged by
  the TLS wrap — just reached one hop later now).

## 2. Architecture (why this shape)

```
Vercel (apps/web / apps/api, dynamic IP)
   - holds: AUDD mTLS client cert + key, AUDD_GATEWAY_API_KEY
   - packages/core/.../providers/audd/audd-transport.ts — node:https + HttpsProxyAgent
        │  TLS-wrapped CONNECT tunnel to the relay (BasicAuth in the https:// proxy URL)
        ▼
stunnel — public :28443, terminates ONLY this outer TLS hop (this runbook, §5)
   - protects the BasicAuth credential in transit between Vercel and the VPS (CWE-319 fix,
     #2474 D20 follow-up) — separate concern from, and unrelated to, the AUDD mTLS below
        │  plaintext, loopback only
        ▼
tinyproxy — 127.0.0.1:28444 (this runbook, §4)
   - blind TCP forward, scoped to api.sandbox.audd.digital only — never terminates the AUDD mTLS
   - cannot read or complete the mTLS handshake (holds no cert) — a compromised relay alone
     can't impersonate Hypha to AUDD, regardless of the outer TLS layer
        │  mTLS (same connection throughout, untouched by either hop above)
        ▼
AUDD Gateway API (api.sandbox.audd.digital)
```

**Two independent TLS layers, easy to conflate — don't.** The *outer* layer (Vercel↔stunnel) only
protects the relay's own `BasicAuth` secret from passive network observation on that hop. The
*inner* layer (mTLS, Vercel↔AUDD) is the one that actually authenticates Hypha to AUDD and is
completely unaffected by adding or removing the outer layer — it was never terminated by the relay
before this change, and still isn't now. Adding stunnel does not "terminate TLS in front of
tinyproxy" in the sense of decrypting AUDD traffic; it wraps a *separate* TLS session around the
proxy-protocol conversation only, fully unwrapped again before tinyproxy ever sees a byte.

**Why not Caddy for the relay itself** (already running on this box, for the Matrix stack):
`reverse_proxy` terminates TLS at the HTTP layer to route by host/path and isn't built to handle
the `CONNECT` method's raw-tunnel semantics — that's what forced tinyproxy in D1's original design,
and remains true for the new outer TLS layer too, hence a dedicated tool (stunnel) rather than an
addition to Caddy.

**Why `tinyproxy`'s own `BasicAuth`, not an IP allowlist:** Vercel has no static outbound IP (that's
the whole reason this relay exists), so the relay can't gate by source IP the way AUDD gates *us*.
`BasicAuth` is a third, independent secret from the mTLS cert/key and the stunnel TLS cert — a
leaked Vercel env var shouldn't compromise more than one layer at once.

## 3. SSH onto the VPS

```bash
ssh root@srv1294735.hstgr.cloud
```

## 4. Current config — tinyproxy (as deployed 2026-09-22, moved to loopback 2026-09-23)

- **Service:** `tinyproxy` (native `apt` package, Ubuntu 24.04 — not Dockerized, unlike the
  Matrix/LiveKit stack under `/srv/matrix/`)
- **Port:** `28444`, **loopback only** (`Listen 127.0.0.1`) — moved off the public `28443` when
  stunnel took over that port (§5). No longer directly reachable from outside the VPS; stunnel is
  now the only path in.
- **Config file:** `/etc/tinyproxy/tinyproxy.conf` (stock original backed up to
  `/etc/tinyproxy/tinyproxy.conf.orig`)
- **Filter file:** `/etc/tinyproxy/audd-allowed-hosts` — one line,
  `^api\.sandbox\.audd\.digital$`. Add a second line for the production host once AUDD provisions
  one; don't widen this to a wildcard.
- **Auth:** `BasicAuth hypha_audd <relay-secret>` — the secret is a random value from
  `openssl rand -base64 24`, **not** derived from or stored alongside the AUDD mTLS cert/key or the
  stunnel TLS cert. Recorded in Vaultwarden / Ger's secure storage, not in this repo, not in chat.
- **Firewall:** `ufw` is **inactive** on this box (traffic control is whatever's listening +
  Hostinger's panel-level firewall). `28443/tcp` (the public port — now stunnel's, not tinyproxy's
  directly) was opened in the **Hostinger panel firewall** (source `0.0.0.0/0` — can't restrict by
  source IP here either, same reason as above). `28444` is loopback-only and needs no firewall rule.

```ini
# /etc/tinyproxy/tinyproxy.conf
User tinyproxy
Group tinyproxy
Port 28444
Listen 127.0.0.1
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

## 5. Current config — stunnel (deployed 2026-09-23, #2474 D20 follow-up)

**Why reuse Caddy's cert instead of a fresh certbot cert:** the Matrix/LiveKit Docker Compose stack
on this same box already runs Caddy with a valid, auto-renewing Let's Encrypt certificate for
`srv1294735.hstgr.cloud` (confirmed in #2361 D9 — adding new Caddy site blocks for this hostname
required "no new DNS, no new certs" precisely because this cert already existed). Reusing it avoids
standing up a second, redundant ACME client and avoids any interaction with the running Matrix
stack (no stopping Caddy, no touching its container, no new DNS/port-80 dance) — just a read-only
file read from the volume Docker already manages.

- **Service:** `audd-relay-stunnel` — a **dedicated systemd unit**, not the distro package's own
  `stunnel4.service`. The package's SysV-compat unit (generated by `systemd-sysv-generator` from
  the old `/etc/init.d/stunnel4` script) doesn't correctly track a forking daemon on this system —
  it reports `inactive (dead)` immediately after a successful start, because the init script forks
  stunnel into the background and systemd loses track of the child process. Fix: stunnel's own
  `foreground = yes` option keeps it in the foreground, and a plain `Type=simple` unit tracks that
  foreground process directly — see §9 for the full symptom/fix if this needs redoing elsewhere.
  The package's `stunnel4.service` is disabled (`systemctl disable stunnel4`) so it can't
  double-start the same config file.
- **Port:** public `28443` (took over the port tinyproxy used to own directly), forwarding to
  tinyproxy on loopback `28444`.
- **Config file:** `/etc/stunnel/audd-relay.conf`. **`foreground` is a global stunnel option and
  must appear before the `[audd-relay]` section header, not inside it** — putting it inside the
  section causes an immediate parse failure (exit code 1, no useful log line beyond "exited"). This
  was the first thing that broke deploying this; see §9.
- **Certificate source:** read directly from the Matrix stack's `caddy_data` Docker volume — **not
  copied, not a bind mount added to the compose file, no changes to that stack at all**:
  ```bash
  docker volume inspect matrix_caddy_data --format '{{ .Mountpoint }}'
  # -> /var/lib/docker/volumes/matrix_caddy_data/_data
  ```
  Cert files live at a fixed path under that mountpoint (Caddy's own internal layout):
  `caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud/`.

```ini
# /etc/stunnel/audd-relay.conf
foreground = yes

[audd-relay]
client = no
accept = 0.0.0.0:28443
connect = 127.0.0.1:28444
cert = /var/lib/docker/volumes/matrix_caddy_data/_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud/srv1294735.hstgr.cloud.crt
key = /var/lib/docker/volumes/matrix_caddy_data/_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud/srv1294735.hstgr.cloud.key
```

```ini
# /etc/systemd/system/audd-relay-stunnel.service
[Unit]
Description=AUDD relay stunnel TLS wrapper (audd-relay.conf)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/stunnel4 /etc/stunnel/audd-relay.conf
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Cert renewal:** Caddy renews and rewrites those files in place on its own schedule — stunnel
needs to notice and reload. An hourly cron job compares the cert file's mtime against a stamp file
and restarts `audd-relay-stunnel` only when it changed:

```bash
# /usr/local/bin/audd-relay-cert-sync.sh
#!/bin/sh
CADDY_VOL=$(docker volume ls --format '{{.Name}}' | grep caddy_data)
CADDY_DATA=$(docker volume inspect "$CADDY_VOL" --format '{{ .Mountpoint }}')
CERT="$CADDY_DATA/caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud/srv1294735.hstgr.cloud.crt"
STAMP="/var/lib/audd-relay-cert.stamp"
CURRENT=$(stat -c %Y "$CERT" 2>/dev/null || echo 0)
LAST=$(cat "$STAMP" 2>/dev/null || echo 0)
if [ "$CURRENT" != "$LAST" ]; then
  systemctl restart audd-relay-stunnel
  echo "$CURRENT" > "$STAMP"
fi
```

Installed via `/etc/cron.d/audd-relay-cert-sync`: `17 * * * * root /usr/local/bin/audd-relay-cert-sync.sh`.
Re-derives the volume path fresh on every run (no dependency on any interactive shell state) so it
keeps working even if the volume is ever recreated with a different name/mountpoint.

## 6. Deploy from scratch (if the box is rebuilt)

**tinyproxy:**

```bash
apt-get update && apt-get install -y tinyproxy

RELAY_PASSWORD=$(openssl rand -base64 24)
echo "SAVE THIS — goes into the Vercel AUDD_GATEWAY_HTTPS_PROXY env var:"
echo "  AUDD_GATEWAY_HTTPS_PROXY=https://hypha_audd:${RELAY_PASSWORD}@srv1294735.hstgr.cloud:28443"

cat > /etc/tinyproxy/audd-allowed-hosts <<'EOF'
^api\.sandbox\.audd\.digital$
EOF

cp /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf.orig

cat > /etc/tinyproxy/tinyproxy.conf <<EOF
User tinyproxy
Group tinyproxy
Port 28444
Listen 127.0.0.1
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
ss -tlnp | grep 28444
```

**stunnel:**

```bash
apt-get install -y stunnel4

CADDY_VOL=$(docker volume ls --format '{{.Name}}' | grep caddy_data)
CADDY_DATA=$(docker volume inspect "$CADDY_VOL" --format '{{ .Mountpoint }}')
CERT_DIR="$CADDY_DATA/caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud"
ls "$CERT_DIR"   # sanity check the Caddy cert actually exists before wiring stunnel to it

cat > /etc/stunnel/audd-relay.conf <<EOF
foreground = yes

[audd-relay]
client = no
accept = 0.0.0.0:28443
connect = 127.0.0.1:28444
cert = $CERT_DIR/srv1294735.hstgr.cloud.crt
key = $CERT_DIR/srv1294735.hstgr.cloud.key
EOF

systemctl disable stunnel4 2>/dev/null
systemctl stop stunnel4 2>/dev/null

cat > /etc/systemd/system/audd-relay-stunnel.service <<'EOF'
[Unit]
Description=AUDD relay stunnel TLS wrapper (audd-relay.conf)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/stunnel4 /etc/stunnel/audd-relay.conf
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now audd-relay-stunnel
systemctl status audd-relay-stunnel --no-pager
ss -tlnp | grep 28443

cat > /usr/local/bin/audd-relay-cert-sync.sh <<'EOF'
#!/bin/sh
CADDY_VOL=$(docker volume ls --format '{{.Name}}' | grep caddy_data)
CADDY_DATA=$(docker volume inspect "$CADDY_VOL" --format '{{ .Mountpoint }}')
CERT="$CADDY_DATA/caddy/certificates/acme-v02.api.letsencrypt.org-directory/srv1294735.hstgr.cloud/srv1294735.hstgr.cloud.crt"
STAMP="/var/lib/audd-relay-cert.stamp"
CURRENT=$(stat -c %Y "$CERT" 2>/dev/null || echo 0)
LAST=$(cat "$STAMP" 2>/dev/null || echo 0)
if [ "$CURRENT" != "$LAST" ]; then
  systemctl restart audd-relay-stunnel
  echo "$CURRENT" > "$STAMP"
fi
EOF
chmod +x /usr/local/bin/audd-relay-cert-sync.sh
echo "17 * * * * root /usr/local/bin/audd-relay-cert-sync.sh" > /etc/cron.d/audd-relay-cert-sync
/usr/local/bin/audd-relay-cert-sync.sh   # seed the stamp file
```

Then open `28443/tcp` (source `0.0.0.0/0`) in the **Hostinger panel firewall** — see §7, this is
the step most likely to be forgotten (the service comes up fine locally without it; only external
reachability fails, silently, as a connect timeout).

## 7. Verify (copy-paste)

**From the VPS itself** (isolates the relay's own logic from any network/firewall question):

```bash
RELAY_PASSWORD="<the secret>"

echo "--- 1) no credentials -> expect 407 ---"
curl -sv --proxy "https://srv1294735.hstgr.cloud:28443" https://api.sandbox.audd.digital/ 2>&1 | grep -E "< HTTP|407"

echo "--- 2) allowed host -> expect CONNECT 200 ---"
curl -sv --proxy "https://hypha_audd:${RELAY_PASSWORD}@srv1294735.hstgr.cloud:28443" https://api.sandbox.audd.digital/ 2>&1 | grep -E "CONNECT|Connection established|< HTTP"

echo "--- 3) disallowed host -> expect 403 Filtered ---"
curl -sv --proxy "https://hypha_audd:${RELAY_PASSWORD}@srv1294735.hstgr.cloud:28443" https://example.com/ 2>&1 | grep -E "CONNECT|< HTTP|403"
```

Use the real hostname, not `127.0.0.1` — the stunnel TLS cert is issued for
`srv1294735.hstgr.cloud` specifically, so a bare-IP connection fails certificate verification
before any HTTP response exists to check (a silent-looking failure, not a sign anything is broken).

**From outside** (confirms the Hostinger panel firewall rule is actually live) — same commands as
above, run from a machine that isn't the VPS.

`CONNECT tunnel established, response 200` = healthy end to end. `Failed to connect ... after
21089 ms` (a hang, not an immediate refusal) with the VPS-local test passing = the Hostinger panel
firewall rule isn't open yet — that exact failure mode is what we hit deploying the original
tinyproxy-only relay (2026-09-22).

## 8. Hostinger panel firewall

`ufw` is inactive on this box — port exposure is controlled by Hostinger's **panel-level**
firewall, not anything visible over SSH. To open the relay port:

1. Hostinger control panel → this VPS → **Firewall**.
2. Add an inbound rule: **TCP**, port **`28443`**, source **Anywhere / `0.0.0.0/0`**.
3. Apply — takes about a minute to propagate. Re-run the external `curl` test in §7.

(This rule didn't change when stunnel took over the port — `28443` was already open; only what's
listening behind it changed, from tinyproxy directly to stunnel.)

## 9. Vercel-side wiring

Single env var, proxy URL with the secret embedded (not split into a separate variable — see §2
on why the secret lives only in this one place). **Scheme is `https://`, not `http://`** — this
changed 2026-09-23 when the outer TLS layer was added; the host, port, and credentials are
unchanged:

```
AUDD_GATEWAY_HTTPS_PROXY=https://hypha_audd:<relay-secret>@srv1294735.hstgr.cloud:28443
```

Consumed by `packages/core/src/banking/server/providers/audd/audd-transport.ts` via
`HttpsProxyAgent`, which inspects the URL scheme to decide whether to TLS-wrap the connection *to
the proxy itself* (`https:`) or not (`http:`) — no code change was needed to add the outer TLS
layer, only this env var's scheme. When set, every `/customer/*` call tunnels through the relay
with the mTLS cert/key attached to the *destination* TLS handshake (to AUDD), which neither stunnel
nor tinyproxy ever sees. Unset ⇒ the client connects to AUDD directly (only works from an
already-allowlisted egress IP — the VPS itself, or the local SSH-tunnel dev workaround, #2362
D3 — not from Vercel).

## 10. Troubleshooting

**`stunnel4`/`audd-relay-stunnel` config parse fails immediately (exit code 1, no useful log):**
almost always `foreground = yes` placed *inside* the `[audd-relay]` section instead of before it —
`foreground` is a global stunnel option, not a per-service one. Fix: move it above the section
header. `journalctl -u audd-relay-stunnel -n 20` and running `stunnel4 /etc/stunnel/audd-relay.conf`
directly in the foreground both surface the real parse error immediately.

**The package's own `stunnel4.service` shows `inactive (dead)` right after `systemctl enable --now`,
with no journal entries at all:** the SysV-compat unit (generated from `/etc/init.d/stunnel4` by
`systemd-sysv-generator`) doesn't correctly track stunnel's forking daemon on this system — systemd
loses the child process the moment the parent forks and exits, and reports the service as having
stopped rather than failed. Don't debug the package unit further; use `foreground = yes` in the
config plus a dedicated `Type=simple` unit (`audd-relay-stunnel.service`, §5/§6) instead, and
disable the package's own unit so it can't double-start the same config file.

**Config won't parse / `tinyproxy -d -c ... ` errors `Syntax error on line N`:** almost always a
shell-variable interpolation problem in the heredoc (e.g. `${RELAY_PASSWORD}` was empty because the
SSH session was reset between generating it and writing the config, leaving a bare `BasicAuth
hypha_audd` with nothing after it). Check with `sed -n '<N>p' /etc/tinyproxy/tinyproxy.conf`, fix
directly with `sed -i "s|^BasicAuth .*|BasicAuth hypha_audd <password>|" ...`, don't re-run the
whole heredoc blind.

**Leftover manual test process still bound to the port before starting the systemd service:**
`ps aux | grep tinypro[x]y` (or `stunnel[4]` for the TLS layer) — a `kill %N` in one shell won't
reach a background job started in a different SSH session (job numbers are per-shell). Kill by PID
directly, confirm `ss -tlnp` no longer shows it, then start the systemd service.

**External `curl` hangs/times out but the VPS-local test passes:** Hostinger panel firewall rule
missing — see §8. A *reachable-but-closed* port (relay down, or a host-level `ufw` block) usually
fails fast with `Connection refused`; a silent hang/timeout across a cloud provider's edge is the
signature of a firewall drop upstream of the box.

**`curl --proxy https://127.0.0.1:28443 ...` fails with no clear HTTP response:** not a relay bug —
the stunnel cert is issued for `srv1294735.hstgr.cloud`, so connecting via bare IP fails hostname
verification before any HTTP exchange happens. Use the real hostname in tests.

**Logs:** `journalctl -u audd-relay-stunnel -f` (TLS layer), `/var/log/tinyproxy/tinyproxy.log` or
`journalctl -u tinyproxy -f` (proxy layer).

**Rollback:** `systemctl stop audd-relay-stunnel tinyproxy && systemctl disable audd-relay-stunnel
tinyproxy`, restore `/etc/tinyproxy/tinyproxy.conf.orig` if needed. Doesn't touch Caddy or the
Matrix/LiveKit stack — fully isolated (stunnel only *reads* Caddy's cert files, never writes to or
restarts anything in that stack).

## 11. Rotating the relay secret

1. Generate a new one: `openssl rand -base64 24`.
2. `sed -i "s|^BasicAuth .*|BasicAuth hypha_audd <new-secret>|" /etc/tinyproxy/tinyproxy.conf`
3. `systemctl restart tinyproxy`
4. Update `AUDD_GATEWAY_HTTPS_PROXY` in Vercel (all environments using it) with the new secret —
   scheme stays `https://`, only the password changes.
5. Re-run the §7 verification.

(Unaffected by the stunnel TLS layer — that's a separate secret, the stunnel/Caddy certificate,
which rotates on its own via Caddy's auto-renewal + the §5 cron sync, no manual action needed.)

## 12. Checklist (operator sign-off)

- [ ] `systemctl status tinyproxy` → `active (running)`, on `127.0.0.1:28444`
- [ ] `systemctl status audd-relay-stunnel` → `active (running)`, on `0.0.0.0:28443`
- [ ] `/etc/tinyproxy/audd-allowed-hosts` contains only the intended AUDD host(s) — no wildcards
- [ ] `/etc/stunnel/audd-relay.conf` has `foreground = yes` *before* `[audd-relay]`
- [ ] Package's own `stunnel4.service` is disabled (not competing with `audd-relay-stunnel`)
- [ ] `/etc/cron.d/audd-relay-cert-sync` installed and has run at least once (stamp file exists)
- [ ] VPS-local §7 tests (using the real hostname): 407 / 200 / 403 as expected
- [ ] Hostinger panel firewall: `28443/tcp` open, `0.0.0.0/0`
- [ ] External §7 test: `CONNECT tunnel established, response 200`
- [ ] Relay secret saved in secure storage, **not** alongside the mTLS cert/key, **not** in git
- [ ] `AUDD_GATEWAY_HTTPS_PROXY` set in the relevant Vercel environment(s), scheme `https://`
