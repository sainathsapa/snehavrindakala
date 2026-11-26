# Lightsail 2 GB — the exact clicks

$12/month, no ALB, no NAT gateway, no RDS. One instance runs the whole
`docker-compose.yml` (Postgres, Redis, Medusa, storefront, Caddy) exactly as it
runs on a laptop. Everything here has already been verified in the repo except
the parts that need your AWS account.

Total: **$12/mo** hosting + ~$3/mo if you enable daily snapshots. Domain,
Razorpay's ~2% and Shiprocket per-parcel are separate.

## 1. Create the instance (5 min)

Lightsail → **Create instance**:

| Field | Value |
|---|---|
| Region | **Mumbai, ap-south-1** (closest to you and most buyers) |
| Platform | **Linux/Unix** |
| Blueprint | **OS only → Ubuntu 24.04 LTS** |
| Instance plan | **$12** — 2 vCPU, 2 GB RAM, 60 GB SSD, 3 TB transfer |
| Instance name | `snehavrinda-prod` |

Do **not** pick an "app" blueprint (Node/Docker images ship old runtimes and
fight the bootstrap script).

## 2. Static IP (must be done, or a stop/start changes your address)

Lightsail → **Networking** → **Create static IP** → attach to `snehavrinda-prod`.
Outbound IP becomes the one you point DNS at.

## 3. Firewall

Lightsail → instance → **Networking** → IPv4 Firewall:

| Application | Port | Restrict to |
|---|---|---|
| HTTP | 80 | Anywhere |
| HTTPS | 443 | Anywhere |
| SSH | 22 | **your IP only** |

80 is not optional: Caddy uses it for the Let's Encrypt HTTP challenge.

## 4. DNS — keep it in Cloudflare

Your domain's nameservers are already Cloudflare. Add two records, both
**DNS only (grey cloud)** — proxying to a host that terminates its own TLS
through Cloudflare's proxy gives you 525/526 errors and hides the real client IP
from Caddy:

```
A   www   → <static IP>   DNS only
A   api   → <static IP>   DNS only
```

The apex `snehavrinda.in` already 307-redirects to `www`, so leave it alone.

## 5. Run the bootstrap

```bash
ssh ubuntu@<static IP>
curl -fsSL https://raw.githubusercontent.com/sainathsapa/snehavrindakala/release/owner-input-staging-qualification/deploy/bootstrap-vps.sh -o bootstrap.sh
bash bootstrap.sh
```

It checks RAM/disk, installs Docker, **adds 2 GB swap** (this box builds Medusa
and the storefront; without swap the build is OOM-killed at ~80% and looks like
a code bug), clones the branch, then stops because there is no `.env`.

From your laptop:

```bash
cd ~/dsk/snehakala
scp .env ubuntu@<static IP>:~/snehavrindakala/.env
```

Re-run `bash bootstrap.sh`. It starts the stack, waits for Postgres, runs
migrations and prints four results:

```
storefront  /            HTTP 200
medusa      /health      HTTP 200
webhook, no token        HTTP 401   (expect 401)
webhook, correct token   HTTP 200   (expect 200)
```

A `000` instead of a number means DNS has not propagated yet — Caddy cannot get
a certificate until `www` and `api` both resolve to the static IP.

## 6. Point Shiprocket at it

Settings → Webhooks:

| Field | Value |
|---|---|
| URL | `https://www.snehavrinda.in/api/webhooks/courier` |
| Auth Token Type | `x-api-key` |
| Token | value of `SHIPROCKET_WEBHOOK_TOKEN` in `.env` |
| Connection | ENABLED |

## 7. Backups — do this before the first order

Two independent layers, because a Lightsail instance dying takes its own disk
with it:

1. **Nightly dumps in the box** (already written, opt-in):
   ```bash
   cd ~/snehavrindakala
   docker compose --profile ops up -d backup
   ```
   Writes to the `backup` volume, keeps `BACKUP_RETENTION_DAYS` (default 14).
   Prove it restores once: `bash scripts/restore-drill.sh`.
2. **Lightsail automatic snapshots**: instance → **Snapshots** → enable daily,
   keep 7. ~$3/mo at 60 GB. This is what saves you if the disk is corrupted.

## 8. Costs and when to grow

| Item | Monthly |
|---|---|
| Lightsail 2 GB | $12 |
| Static IP | included (free while attached) |
| Snapshots (7 daily, 60 GB) | ~$3 |
| **Total** | **~$15** |

Move to the `infra/terraform/` ECS + RDS stack when any of these becomes true:
you need zero-downtime deploys, managed Postgres with point-in-time recovery, or
more than roughly 50 orders/day. Right-size that stack first — dropping the NAT
gateway and shrinking RDS from 100 GB lands it near $45/mo instead of $100.

## Known limits of this box

- Builds are slow (2 vCPU, swap-backed). A cold `--build` of both apps takes
  10–20 minutes. Normal deploys that reuse layers are a few minutes.
- Everything shares 2 GB. If you later add Meilisearch, a queue worker or a
  second storefront, go to the 4 GB ($24) plan rather than tuning swap.
- Media uploads live in a Docker volume on this disk. Move them to the S3 bucket
  already defined in `infra/terraform/s3.tf` before you have traffic you cannot
  lose.
