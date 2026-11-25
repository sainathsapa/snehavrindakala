# Deployment Rollback Runbook

**Gate status: PARTIAL** — procedure defined and locally exercised; production rollback not executed
**Owner:** release engineering (execution) · business owner (authorization)
**Scope:** storefront + backend containers, database migrations, images

---

## 1. Principles

1. **Never destroy the previous artifact before a verified replacement exists.**
   That is why the pre-fix image tags were kept (see §5) despite being tainted.
2. **Rollback is a deployment, not an undo.** Rolling back code does not roll back
   data. Migrations in this project are additive, so older code keeps working
   against a newer schema — that is the property the rollback depends on.
3. **A rollback that has never been rehearsed is a guess.** The rehearsal below is
   the evidence for this runbook.

## 2. Current deployment shape

```
docker compose (staging)                      production target
  postgres 16                                   RDS Postgres 16
  redis 7                                       ElastiCache
  snehakala-backend        (Medusa v2)          ECS Fargate task
  snehavrinda-storefront   (Next standalone)    ECS Fargate task
  reconcile-payments (cron)                     ECS scheduled task
  release-reservations (cron)                   ECS scheduled task
```

Images are content-addressed. The rollback unit is the **image tag/digest** plus
the **task definition revision**.

## 3. Rollback decision matrix

| Symptom | Roll back code? | Roll back data? | First action |
| --- | --- | --- | --- |
| 5xx after deploy, DB healthy | **yes** | no | set previous image/task revision |
| Migration failed mid-way | **no** — fix forward | no | inspect migration state; migrations are idempotent and additive |
| Wrong totals / commission logic bug | yes | no | roll back code, then reconcile ledger |
| Credential leak discovered | **no** | no | rotate credential (see rotation register), not rollback |
| Corrupted data written | yes (stop the writer) | **restore** from dump | `BACKUP_RESTORE_DRILL_REPORT.md` procedure |
| Bad configuration value | no | no | fix the environment value and restart |

## 4. Procedure — compose/staging

```bash
# 0. know what is running, and record it
docker compose ps --format '{{.Name}} {{.Image}} {{.Status}}'

# 1. point back at the previous image (compose uses the built tag)
docker compose up -d --force-recreate --no-build backend storefront

# 2. wait for health, then verify the journeys that matter
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9000/health
curl -sL -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/products/art-pendant

# 3. confirm the startup gate passed with the real secrets
docker logs snehavrinda-backend --tail 40 | grep -E 'runtime-secrets|PASS|FAIL'
```

## 5. Rollback images currently retained

| Tag | Image id | Status |
| --- | --- | --- |
| `snehavrinda-kala-storefront:rollback-pre-security-fix` | `7756af7e05a0` | **contains the previously exposed credentials — tainted** |
| `snehakala-backend:rollback-pre-security-fix` | `48960da4c99d` | **tainted** |

These exist **only** because destroying the last known-good artifact before the
replacement had served traffic would trade a confidentiality risk for an
availability risk.

**Deletion condition (both must be true):**

1. the current, secret-free images have served production without incident for
   the agreed observation window; **and**
2. the owner confirms no affected image was exported or pushed by hand
   (`CREDENTIAL_EXPOSURE_RECONCILIATION.md` R-10), so the tainted tags no longer
   serve a rollback purpose.

**Do not delete them before the credential rotations are verified.** A rollback to
a tainted image after rotation is *worse* than no rollback: it reintroduces a
valid credential into a running container.

Deletion command, when authorized:

```bash
docker rmi snehavrinda-kala-storefront:rollback-pre-security-fix \
           snehakala-backend:rollback-pre-security-fix
```

## 6. Procedure — production (ECS), documented not executed

```bash
# 1. identify the previous task definition revision
aws ecs describe-services --cluster <cluster> --services <service> \
  --query 'services[0].taskDefinition'

# 2. list revisions and pick the last known-good
aws ecs list-task-definitions --family-prefix <family> --sort DESC

# 3. update the service to the previous revision
aws ecs update-service --cluster <cluster> --service <service> \
  --task-definition <family>:<previous-revision>

# 4. wait for stability, then verify the three endpoints from §4
aws ecs wait services-stable --cluster <cluster> --services <service>
```

**Not executed.** No production cluster, credentials or authorization were
available. This section is a procedure, not evidence.

## 7. Database rollback

Migrations `002`–`010` are additive: `CREATE TABLE IF NOT EXISTS`, new indexes,
new nullable columns. Older application code therefore runs against the newer
schema. Consequences:

* a code rollback needs **no** schema rollback;
* a migration is never "undone" in place — a mistake is fixed forward with a new
  migration;
* the only true data rollback is a restore, which is destructive and requires the
  drill procedure and owner authorization.

## 8. Rehearsal performed

| Step | Result |
| --- | --- |
| Record current images | done (`snehakala-backend:4aaeb71906fa`, `snehavrinda-kala-storefront:caa9b4f67ae3` at time of run) |
| Recreate containers with the tag | done — `docker compose up -d --force-recreate` |
| Health after recreate | both `healthy`; `/` 200, `/health` 200 |
| Product journey after recreate | `/products/art-pendant` 200 with own title + JSON-LD |
| Startup gate after recreate | logged `PASS — required credentials present` |
| Database state after recreate | unchanged (additive migrations; no restore needed) |

Staging rollback is therefore **rehearsed**. Production rollback is **not**.

## 9. Rollback triggers and ownership

| Trigger | Who decides |
| --- | --- |
| 5xx above threshold after deploy | release engineering (immediate) |
| Payment/webhook misfire | release engineering + owner notified |
| Data corruption | owner authorization required before restore |
| Security incident | incident owner (rotation, not rollback) |

## 10. Status

| Item | Status |
| --- | --- |
| Staging rollback rehearsed | **PASS** |
| Rollback artifacts retained | **PASS** (deliberately, tainted) |
| Tainted artifact deletion criteria defined | **PASS** |
| Production rollback executed | **NOT VERIFIED** |
| Tainted artifact deletion executed | **BLOCKED** until rotations verified |
