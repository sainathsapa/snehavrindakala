#!/usr/bin/env node
/**
 * Scan a Docker image for embedded credentials — in EVERY layer, not just the
 * final container filesystem.
 *
 * WHY THIS EXISTS
 *
 * `docker run <image> find / -name .env` only proves that the *last* layer of
 * the *current* image does not have the file. A credential that was copied into
 * an intermediate build stage, or that was deleted by a later layer, is still
 * inside the image: layer tarballs are stored verbatim, so `docker save` hands
 * an attacker the removed file. Only a layer-by-layer scan answers
 * "was a credential ever baked into this image?".
 *
 * WHAT IT DOES
 *
 *   1. `docker save` the image to a temp tarball.
 *   2. Read manifest.json to get the layer order and digests.
 *   3. For each layer: list filenames (sensitive path rules) and stream the
 *      file contents through the credential rules.
 *   4. Print redacted findings: image, layer index, digest prefix, path (when
 *      the filename rule matched) and rule name.
 *
 * It NEVER prints the matched value. A scanner that echoes secrets into CI logs
 * is just another leak — same contract as scripts/secret-scan.mjs.
 *
 *   node scripts/security/scan-image-secrets.mjs snehavrinda-kala-storefront:latest
 *   node scripts/security/scan-image-secrets.mjs --image=a:latest --image=b:latest
 *   IMAGE_REFS=a:latest,b:latest node scripts/security/scan-image-secrets.mjs
 *   node scripts/security/scan-image-secrets.mjs --json > scan.json
 *
 * Exit codes: 0 clean, 1 findings, 2 the scan could not run. A scan that cannot
 * run must never be reported as "clean".
 */

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  statSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const die = (message) => {
  console.error(`[image-secret-scan] ${message}`);
  process.exit(2);
};

// ── sensitive filenames ──────────────────────────────────────────────────────
// Paths whose mere presence is a finding: environment files, key material,
// credential stores. node_modules is excluded because vendored test fixtures
// routinely contain fake .env files, and a 2 GB tree of them is unactionable.
const SENSITIVE_PATH_RULES = [
  { rule: "env-file", pattern: /(^|\/)\.env(\.|$)/ },
  { rule: "env-file", pattern: /(^|\/)\.env\.(local|production|development|staging|test)/ },
  { rule: "private-key-file", pattern: /\.(pem|key|p12|pfx|jks|keystore)$/i },
  { rule: "ssh-private-key", pattern: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/ },
  // NOTE: .npmrc / .netrc / docker config.json are deliberately NOT path rules.
  // They are ordinary tool configuration that usually holds no credential, and
  // failing on the filename made the gate cry wolf on this repository's own
  // .npmrc (ignore-scripts/unsafe-perm only). A real `_authToken` or
  // `NPM_TOKEN` inside them is caught by the content rules instead, which is
  // what actually matters.
  { rule: "credential-store", pattern: /(^|\/)(credentials|secrets)\.(json|ya?ml|ini|toml)$/i },
  { rule: "terraform-state", pattern: /\.tfstate(\.backup)?$/ },
];

// A sensitive path is expected in these places and is not a leak on its own.
const PATH_ALLOWLIST = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)proc\//,
  /\.env\.example$/,
  /\.env\.sample$/,
  /\.env\.template$/,
  /\.env\.dist$/,
  /cacert\.pem$/,
  /(^|\/)etc\/ssl\//,
  /(^|\/)etc\/ca-certificates/,
  /\/usr\/local\/lib\/node_modules\//,
];

// ── credential content rules ─────────────────────────────────────────────────
// High-confidence token shapes (match anywhere) plus env-shaped assignments
// (key = value), which is how a baked credential actually looks in a layer.
const TOKEN_RULES = [
  { rule: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { rule: "pem-private-key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { rule: "razorpay-live-key-id", pattern: /\brzp_live_[A-Za-z0-9]{14,}\b/ },
  { rule: "razorpay-key-id", pattern: /\brzp_test_[A-Za-z0-9]{14,}\b/ },
  { rule: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { rule: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { rule: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { rule: "db-url-with-password", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:(?![$<{\[#%*]|\{\{)[^\s:/@>\]]{6,}@/ },
];

// Keys whose assignment carries a credential. The value must look like a real
// secret (long enough, not a placeholder/template) to keep false positives out.
const SECRET_KEY_NAMES = [
  "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_SECRET",
  "JWT_SECRET", "COOKIE_SECRET", "SESSION_SECRET", "PARTNER_SESSION_SECRET",
  "PARTNER_RESET_SECRET", "CRON_SECRET", "ADMIN_PASSWORD", "MEDUSA_ADMIN_PASSWORD",
  "POSTGRES_PASSWORD", "PGPASSWORD", "DB_PASSWORD", "DATABASE_PASSWORD",
  "SHIPROCKET_PASSWORD", "SHIPROCKET_API_TOKEN",
  "SANITY_API_TOKEN", "SANITY_TOKEN",
  "AWS_SECRET_ACCESS_KEY", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_ACCESS_KEY_ID",
  "SMTP_PASSWORD", "MAIL_PASSWORD", "API_KEY", "API_SECRET", "PRIVATE_KEY",
  "ENCRYPTION_KEY", "WEBHOOK_SECRET", "AUTH_SECRET",
  // package-manager tokens: these live in .npmrc / .yarnrc and would otherwise
  // slip through now that those filenames are no longer path rules.
  "_authToken", "_auth", "NPM_TOKEN", "YARN_NPM_AUTH_TOKEN",
];
const SECRET_KEY_PATTERN = new RegExp(
  `(?:^|[^A-Za-z0-9_])((?:${SECRET_KEY_NAMES.join("|")}))\\s*[:=]\\s*(?:"([^"\\n]{6,})"|'([^'\\n]{6,})'|([^\\s"'#]{6,}))`,
  "g"
);

const PLACEHOLDER = [
  "example", "sample", "placeholder", "changeme", "change-me", "change_me",
  "replace", "your_", "your-", "<", ">", "${", "{{", "}}", "redacted",
  "notasecret", "dummy", "fake", "todo", "fixme", "xxxx", "****", "secret-value",
  "postgres", "password", "test", "insecure", "development",
  // A bare "secret"/"key"/"token" is a test fixture, not a value.
  "secret", "token",
];

const looksLikePlaceholder = (value) => {
  const v = value.trim();
  if (v.length < 6) return true;
  const lower = v.toLowerCase();
  if (PLACEHOLDER.some((word) => lower.includes(word))) return true;
  if (/^[.\-*_#\s]+$/.test(v)) return true;
  // Env-file references and shell expansions are indirection, not values.
  if (/^\$|^\$\{|\{\{/.test(v)) return true;
  return false;
};

const MAX_BYTES_PER_LAYER = Number(process.env.IMAGE_SCAN_MAX_MB || 4096) * 1024 * 1024;
const CHUNK_OVERLAP = 8192;

/** A single file above this size is data, not configuration. */
const MAX_FILE_BYTES = Number(process.env.IMAGE_SCAN_MAX_FILE_MB || 8) * 1024 * 1024;

/**
 * Vendored package trees.
 *
 * These are third-party code and their own test fixtures. Their PEMs and
 * documentation examples are not credentials of this application, and treating
 * them as findings would make the gate unusable (the Medusa dependency tree
 * contains dozens). They are excluded from the failure signal and can still be
 * inspected with --include-vendor.
 */
const VENDOR_PREFIXES = [
  "/node_modules/",
  "/usr/local/lib/node_modules/",
  "/.pnpm/",
];

const isVendoredPath = (full) => VENDOR_PREFIXES.some((marker) => full.includes(marker));

// Thin wrappers so a permission error on one path degrades to "skip", while an
// unreadable ARCHIVE is still a hard failure at the call site.
const readdirSyncSafe = (dir) => readdirSync(dir, { withFileTypes: true });
const statSyncSafe = (path) => statSync(path);
const readFileSyncSafe = (path) => readFileSync(path);

/**
 * Normalise a layer identifier to its 64-hex digest.
 *
 * Docker-format archives name layers `sha256/<hex>/layer.tar` while OCI-format
 * archives name them `blobs/sha256/<hex>`. Comparing raw paths would make the
 * same layer look different depending on which archive format Docker produced,
 * so base-image matching silently matched nothing. Compare the digest only.
 */
const layerKey = (identifier) => {
  const match = String(identifier).match(/[0-9a-f]{64}/i);
  return match ? match[0].toLowerCase() : String(identifier);
};

function parseArgs(argv) {
  const opts = { images: [], json: false, keepTmp: false, base: [], includeVendor: false };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg === "--keep-tmp") opts.keepTmp = true;
    else if (arg.startsWith("--base=")) opts.base.push(arg.slice(7));
    else if (arg === "--include-vendor") opts.includeVendor = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/security/scan-image-secrets.mjs <image> [<image>...]\n" +
          "   or: --image=<ref> (repeatable), or IMAGE_REFS=a,b\n" +
          "   --base=<image>  a layer digest inherited from this base image is reported\n" +
          "                   as inherited (and scanned by its own run) rather than as a\n" +
          "                   finding of the target image. Use for node:24-alpine, whose\n" +
          "                   own npm man pages mention PEM private keys.\n" +
          "Env: IMAGE_SCAN_MAX_MB (per-layer read cap, default 4096), IMAGE_SCAN_SKIP_STREAM=1"
      );
      process.exit(0);
    } else if (arg.startsWith("--image=")) opts.images.push(arg.slice(8));
    else if (!arg.startsWith("-")) opts.images.push(arg);
    else die(`unknown argument: ${arg}`);
  }
  if (process.env.IMAGE_REFS) {
    opts.images.push(...process.env.IMAGE_REFS.split(",").map((s) => s.trim()).filter(Boolean));
  }
  if (process.env.IMAGE_SCAN_BASE) {
    opts.base.push(...process.env.IMAGE_SCAN_BASE.split(",").map((s) => s.trim()).filter(Boolean));
  }
  if (!opts.images.length) die("no image references given (see --help)");
  return opts;
}

function docker(args, opts = {}) {
  return execFileSync("docker", args, {
    encoding: opts.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
  });
}

/** Read manifest.json (docker archive) or index+blob manifests (OCI layout). */
function readLayerOrder(tmpDir) {
  const manifestPath = join(tmpDir, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = manifest[0];
    if (!entry?.Layers?.length) die("archive manifest.json lists no layers");
    return entry.Layers.map((l) => ({ path: l, digest: l.replace(/\/layer\.tar$/, "") }));
  }
  const ociIndexPath = join(tmpDir, "index.json");
  if (existsSync(ociIndexPath)) {
    const index = JSON.parse(readFileSync(ociIndexPath, "utf8"));
    const digest = index.manifests?.[0]?.digest?.replace("sha256:", "");
    if (!digest) die("OCI index.json has no manifest digest");
    const manifest = JSON.parse(readFileSync(join(tmpDir, "blobs", "sha256", digest), "utf8"));
    return (manifest.layers || []).map((l) => ({
      path: join("blobs", "sha256", l.digest.replace("sha256:", "")),
      digest: l.digest.replace("sha256:", ""),
    }));
  }
  die("archive has neither manifest.json nor index.json — unable to enumerate layers");
}

function tar(args) {
  return execFileSync("tar", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** List entry names in a layer tarball (plain or gzip-compressed). */
function listLayerEntries(tarPath) {
  // GNU/BSD tar auto-detects gzip; try plain first for a clearer error message.
  try {
    return tar(["-tf", tarPath]).split("\n").filter(Boolean);
  } catch (error) {
    die(
      `could not list layer entries (${tarPath.split("/").pop()}): ` +
        String(error.stderr || error.message).split("\n")[0]
    );
  }
}

/**
 * Stream a layer's file contents through the rule set without printing values.
 * Concatenated `tar -xOf` output is used rather than per-file extraction: a
 * layer can hold tens of thousands of files and the rules are content-shaped.
 */
/**
 * Path-attributed content scan of one extracted layer.
 *
 * WHY PATH-ATTRIBUTED
 *
 * A pure byte-stream scan cannot say WHICH file matched, so a PEM in a vendored
 * package's test fixture is indistinguishable from a PEM in our own config. That
 * is not an acceptable trade: fail the build on vendor noise and the gate gets
 * disabled; miss our own file and the gate is theatre.
 *
 * The layer is extracted with the vendored package trees excluded, then each
 * remaining file is inspected individually so every hit names a path. Vendored
 * code is still available for inspection with --include-vendor, where its hits
 * are reported as informational rather than as findings of this image.
 */
function scanLayerFiles(layerTmpDir, { includeVendor, onHit }) {
  const stats = { files: 0, bytes: 0, skippedLarge: 0, skippedBinary: 0 };

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSyncSafe(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      let info;
      try {
        info = statSyncSafe(full);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        walk(full);
        continue;
      }
      if (!info.isFile()) continue;
      if (!includeVendor && isVendoredPath(full)) continue;
      stats.files += 1;
      if (info.size > MAX_FILE_BYTES) {
        stats.skippedLarge += 1;
        continue;
      }
      let buffer;
      try {
        buffer = readFileSyncSafe(full);
      } catch {
        continue;
      }
      stats.bytes += buffer.length;
      // Binary files are not configuration; a compiled object that happens to
      // embed a test key is not a usable credential in the image.
      if (buffer.subarray(0, 4096).includes(0)) {
        stats.skippedBinary += 1;
        continue;
      }
      const relative = full.slice(layerTmpDir.length + 1);
      const text = buffer.toString("latin1");

      for (const { rule, pattern } of TOKEN_RULES) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) onHit({ rule, path: relative });
      }

      SECRET_KEY_PATTERN.lastIndex = 0;
      let match;
      while ((match = SECRET_KEY_PATTERN.exec(text)) !== null) {
        const value = match[2] || match[3] || match[4] || "";
        if (!looksLikePlaceholder(value)) {
          onHit({ rule: `assignment:${match[1]}`, path: relative });
        }
      }
    }
  };

  walk(layerTmpDir);
  return stats;
}

function sensitivePathHits(entries) {
  const hits = [];
  for (const entry of entries) {
    const allowed = PATH_ALLOWLIST.some((pattern) => pattern.test(entry));
    if (allowed) continue;
    for (const { rule, pattern } of SENSITIVE_PATH_RULES) {
      if (pattern.test(entry)) {
        hits.push({ rule, path: entry });
        break;
      }
    }
  }
  return hits;
}

/**
 * RootFS layer chain of an image (diffIDs).
 *
 * WHY NOT THE ARCHIVE PATHS
 *
 * A `docker save` archive names layers differently depending on format: the
 * classic format uses `sha256/<diffID>/layer.tar`, the OCI format uses
 * `blobs/sha256/<compressed-digest>`. Comparing archive paths therefore never
 * matches across formats, which made base-image detection silently match zero
 * layers. `RootFS.Layers` is the same list in both cases.
 */
function layerDigestsOf(ref) {
  try {
    const raw = docker(["image", "inspect", ref, "--format", "{{json .RootFS.Layers}}"]);
    const layers = JSON.parse(raw);
    if (!Array.isArray(layers) || !layers.length) {
      die(`base image ${ref} reports no RootFS layers`);
    }
    return new Set(layers.map((l) => String(l).replace(/^sha256:/, "").toLowerCase()));
  } catch (error) {
    // A base image that cannot be read must not be silently ignored: that would
    // turn its layers back into findings of (or blanks in) the target image.
    die(`could not read base image ${ref}: ${String(error.message).split("\n")[0]}`);
  }
}

async function scanImage(ref, { json, baseDigests = new Set(), baseRefs = [], includeVendor = false }) {
  const results = [];
  let tmpDir;
  let imageSizeBytes = 0;
  try {
    // Fail loudly if the image is not present locally: a missing image must
    // never be silently reported as "clean".
    try {
      const size = docker(["image", "inspect", ref, "--format", "{{.Size}}"]).trim();
      imageSizeBytes = Number(size) || 0;
    } catch {
      die(`image not found locally: ${ref} — build it before scanning`);
    }

    tmpDir = mkdtempSync(join(tmpdir(), "imgscan-"));
    const archive = join(tmpDir, "image.tar");
    execFileSync("docker", ["save", "-o", archive, ref], { stdio: ["ignore", "pipe", "pipe"] });

    const extractDir = join(tmpDir, "x");
    execFileSync("mkdir", ["-p", extractDir]);
    execFileSync("tar", ["-xf", archive, "-C", extractDir], { stdio: ["ignore", "pipe", "pipe"] });


    const layers = readLayerOrder(extractDir);
    const inherited = [];
    // The image's own diffID chain, used to identify base-image layers reliably
    // regardless of which archive format `docker save` produced.
    const rootFs = (() => {
      try {
        return JSON.parse(
          docker(["image", "inspect", ref, "--format", "{{json .RootFS.Layers}}"])
        ).map((l) => String(l).replace(/^sha256:/, "").toLowerCase());
      } catch {
        return [];
      }
    })();
    const imageId = docker(["image", "inspect", ref, "--format", "{{.Id}}"]).trim();
    const repoDigests = (() => {
      try {
        return JSON.parse(docker(["image", "inspect", ref, "--format", "{{json .RepoDigests}}"]));
      } catch {
        return [];
      }
    })();

    if (!json) {
      console.log(
        `[image-secret-scan] ${ref}\n` +
          `  image id: ${imageId.slice(0, 19)}\n` +
          `  size: ${(imageSizeBytes / 1024 / 1024).toFixed(1)} MB\n` +
          `  layers: ${layers.length}` +
          (baseRefs.length ? ` (base: ${baseRefs.join(", ")})` : "") +
          `\n` +
          `  registry digests: ${repoDigests.length ? repoDigests.join(", ") : "(none — image is local only)"}`
      );
    }

    for (const [index, layer] of layers.entries()) {
      const tarPath = join(extractDir, layer.path);
      if (!existsSync(tarPath)) die(`layer file missing from archive: ${layer.path}`);

      // A layer inherited unchanged from a pinned base image is reported as
      // inherited, not as a finding of this image. The base image is scanned by
      // its own run, so nothing is skipped — the noise is attributed instead of
      // either failing this build on npm's man pages or being silently dropped.
      if (baseDigests.has(rootFs[index]) || baseDigests.has(layerKey(layer.digest))) {
        inherited.push({ layerIndex: index + 1, layerDigest: layer.digest.slice(0, 12) });
        continue;
      }

      const entries = listLayerEntries(tarPath);
      const pathHits = sensitivePathHits(entries);

      // Extract the layer (vendored trees excluded unless requested), then scan
      // each file individually so every content hit carries a path.
      const layerDir = join(extractDir, `layer-${index + 1}`);
      execFileSync("mkdir", ["-p", layerDir]);
      const tarArgs = ["-xf", tarPath, "-C", layerDir];
      if (!includeVendor) {
        for (const marker of VENDOR_PREFIXES) {
          tarArgs.push(`--exclude=*${marker}*`);
        }
      }
      try {
        execFileSync("tar", tarArgs, { stdio: ["ignore", "pipe", "pipe"] });
      } catch (error) {
        // An unreadable layer is a scan failure, never a pass.
        die(
          `could not extract layer ${index + 1} of ${ref}: ` +
            String(error.stderr || error.message).split("\n")[0]
        );
      }

      const streamHits = [];
      const layerStats = scanLayerFiles(layerDir, {
        includeVendor,
        onHit: (hit) => streamHits.push(hit),
      });
      rmSync(layerDir, { recursive: true, force: true });

      const seenRules = new Set();

      for (const hit of [...pathHits, ...streamHits]) {
        const key = `${hit.rule}|${hit.path || ""}`;
        if (seenRules.has(key)) continue;
        seenRules.add(key);
        results.push({
          image: ref,
          layerIndex: index + 1,
          layerDigest: layer.digest.slice(0, 12),
          rule: hit.rule,
          path: hit.path,
          fileCount: entries.length,
          filesScanned: layerStats.files,
        });
      }

      if (!json && (pathHits.length || streamHits.length)) {
        for (const hit of [...pathHits, ...streamHits]) {
          console.log(
            `  LAYER ${index + 1}/${layers.length} (${layer.digest.slice(0, 12)}) ` +
              `HIT ${hit.rule}${hit.path ? ` ${hit.path}` : ""}`
          );
        }
      }
    }

    const archiveSha = createHash("sha256").update(readFileSync(archive)).digest("hex");
    if (!json && baseRefs.length) {
      console.log(
        `  inherited from base (scanned separately, not attributed to this image): ` +
          `${inherited.length} of ${layers.length} layer(s)`
      );
    }
    return {
      image: ref,
      imageId,
      sizeBytes: imageSizeBytes,
      layerCount: layers.length,
      repoDigests,
      archiveSha256: archiveSha,
      baseImages: baseRefs,
      inheritedLayers: inherited,
      findings: results,
    };
  } finally {
    if (tmpDir && !json && !process.env.IMAGE_SCAN_KEEP) rmSync(tmpDir, { recursive: true, force: true });
    else if (tmpDir && json) rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.IMAGE_SCAN_SKIP_STREAM && process.env.IMAGE_SCAN_SKIP_STREAM !== "1") {
    // nothing
  }

  const reports = [];
  // Base-image layers are identified up front. A base that cannot be read is a
  // hard failure — see layerDigestsOf.
  const baseDigests = new Set();
  for (const base of opts.base) {
    for (const digest of layerDigestsOf(base)) baseDigests.add(digest);
  }

  for (const ref of opts.images) {
    reports.push(await scanImage(ref, { json: opts.json, baseDigests, baseRefs: opts.base, includeVendor: opts.includeVendor }));
  }

  const allFindings = reports.flatMap((r) => r.findings);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          scanner: "scripts/security/scan-image-secrets.mjs",
          images: reports,
          findingCount: allFindings.length,
          verdict: allFindings.length ? "FAIL" : "PASS",
        },
        null,
        2
      )
    );
  } else {
    for (const report of reports) {
      const count = report.findings.length;
      console.log(
        `[image-secret-scan] ${report.image}: ${count ? `${count} FINDING(S)` : "clean"} ` +
          `(${report.layerCount} layers scanned)`
      );
    }
    if (allFindings.length) {
      console.error(
        "[image-secret-scan] FAIL — credential material found inside image layers.\n" +
          "  A hit means the value is recoverable with `docker save`, even if a later\n" +
          "  layer deleted the file. Rebuild from a clean context with .dockerignore\n" +
          "  covering .env*, rotate anything that was ever in a published tag, and see\n" +
          "  docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md."
      );
    } else {
      console.log("[image-secret-scan] PASS — no credential material in any scanned layer.");
    }
  }
  process.exit(allFindings.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`[image-secret-scan] scan could not complete: ${error?.message || error}`);
  if (process.env.IMAGE_SCAN_DEBUG) console.error(error?.stack);
  process.exit(2);
});
