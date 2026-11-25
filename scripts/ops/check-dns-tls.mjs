#!/usr/bin/env node
/**
 * DNS / TLS / header readiness check for a deployment hostname.
 *
 * WHY
 *
 * "TLS is configured" is a claim about a live hostname: does it resolve to the
 * expected address, does the certificate chain validate, does the name match,
 * when does it expire, does plain HTTP redirect, and are the security headers
 * actually present? None of that can be asserted from a repository.
 *
 *   node scripts/ops/check-dns-tls.mjs example.com
 *   node scripts/ops/check-dns-tls.mjs --json example.com
 *
 * Exit codes: 0 all critical checks passed, 1 a critical check failed,
 *             2 the check could not run (no network, bad name).
 *
 * This script only reads. It changes no DNS record, certificate or server
 * setting.
 */

import { resolve4, resolve6, resolveCname } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";
import { request } from "node:https";
import http from "node:http";

const args = process.argv.slice(2);
const json = args.includes("--json");
const host = args.find((a) => !a.startsWith("-"));

if (!host) {
  console.error("usage: node scripts/ops/check-dns-tls.mjs [--json] <hostname>");
  process.exit(2);
}

const results = [];
const record = (check, status, detail) => results.push({ check, status, detail });

function tlsProbe(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      { host: hostname, port, servername: hostname, timeout: 10_000 },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
        const daysLeft = validTo
          ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
          : null;
        const subject = cert?.subject?.CN ?? null;
        const issuer = cert?.issuer?.CN ?? null;
        const san = cert?.subjectaltname ?? "";
        resolve({
          ok: socket.authorized !== false,
          authorizationError: socket.authorizationError || null,
          protocol: socket.getProtocol(),
          subject,
          issuer,
          validTo,
          daysLeft,
          san,
          certificateCount: Array.isArray(cert?.issuerCertificate) ? undefined : undefined,
        });
        socket.end();
      }
    );
    socket.on("error", (err) => resolve({ ok: false, error: err.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS connect timed out" });
    });
  });
}

function httpsProbe(url) {
  return new Promise((resolve) => {
    const req = request(url, { method: "GET", timeout: 10_000 }, (res) => {
      const headers = {};
      for (const [k, v] of Object.entries(res.headers)) {
        headers[k] = Array.isArray(v) ? v.join(", ") : v;
      }
      res.resume();
      resolve({ status: res.statusCode, headers });
    });
    req.on("error", (err) => resolve({ error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ error: "HTTPS request timed out" });
    });
    req.end();
  });
}

function httpProbe(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: "GET", timeout: 10_000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location ?? null });
    });
    req.on("error", (err) => resolve({ error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ error: "HTTP request timed out" });
    });
    req.end();
  });
}

async function main() {
  /* ── DNS ── */
  let a = [];
  let aaaa = [];
  let cname = [];
  try {
    [a, aaaa] = await Promise.all([resolve4(host).catch(() => []), resolve6(host).catch(() => [])]);
  } catch {
    /* handled below */
  }
  try {
    cname = await resolveCname(host);
  } catch {
    cname = [];
  }

  if (a.length || aaaa.length) {
    record("dns-resolves", "PASS", { a, aaaa, cname });
  } else if (cname.length) {
    record("dns-cname", "INFO", { cname });
  } else {
    record("dns-resolves", "FAIL", "no A/AAAA/CNAME record returned");
  }

  /* ── TLS ── */
  const tls = await tlsProbe(host);
  if (tls.error) {
    record("tls-handshake", "FAIL", tls.error);
  } else {
    record("tls-chain", tls.ok ? "PASS" : "FAIL", {
      authorizationError: tls.authorizationError,
      protocol: tls.protocol,
      issuer: tls.issuer,
    });
    const matches =
      tls.san?.includes(host) || (tls.subject && tls.subject.includes(host));
    record("tls-hostname-match", matches ? "PASS" : "FAIL", {
      subject: tls.subject,
      san: tls.san,
    });
    if (tls.daysLeft === null) {
      record("tls-expiry", "UNKNOWN", "certificate has no valid_to");
    } else {
      record(
        "tls-expiry",
        tls.daysLeft < 14 ? "FAIL" : tls.daysLeft < 30 ? "WARN" : "PASS",
        { validTo: tls.validTo?.toISOString(), daysLeft: tls.daysLeft }
      );
    }
  }

  /* ── HTTP redirect + headers ── */
  const httpRes = await httpProbe(`http://${host}/`);
  if (httpRes.error) {
    record("http-to-https-redirect", "UNKNOWN", httpRes.error);
  } else {
    const redirects =
      [301, 302, 307, 308].includes(httpRes.status ?? 0) &&
      (httpRes.location ?? "").startsWith("https://");
    record("http-to-https-redirect", redirects ? "PASS" : "FAIL", {
      status: httpRes.status,
      location: httpRes.location,
    });
  }

  const httpsRes = await httpsProbe(`https://${host}/`);
  if (httpsRes.error) {
    record("https-reachable", "FAIL", httpsRes.error);
  } else {
    record("https-reachable", "PASS", { status: httpsRes.status });
    const expectedHeaders = [
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
    ];
    const present = expectedHeaders.filter((h) => httpsRes.headers[h]);
    const missing = expectedHeaders.filter((h) => !httpsRes.headers[h]);
    record("security-headers", missing.length ? "FAIL" : "PASS", { present, missing });
  }

  /* ── report ── */
  if (json) {
    console.log(
      JSON.stringify({ host, generatedAt: new Date().toISOString(), results }, null, 2)
    );
  } else {
    console.log(`[dns-tls] ${host}\n`);
    for (const r of results) {
      const detail =
        typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail);
      console.log(`  ${r.status.padEnd(7)} ${r.check.padEnd(24)} ${detail}`);
    }
  }

  const failed = results.filter((r) => r.status === "FAIL");
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`[dns-tls] check could not run: ${err?.message || err}`);
  process.exit(2);
});
