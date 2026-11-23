"use client";

/**
 * Public application-status page.
 *
 * Reads the `?application=<reference>` query parameter (also accepting a pasted
 * reference), polls the public status endpoint, and renders a professional,
 * accessible status card. Polling stops automatically once a decision is final
 * (approved / rejected). This page is a client component because the status is
 * fetched live; `useSearchParams` is kept behind a Suspense boundary so the
 * route can be statically rendered without a build-time bailout.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Card, CardContent, Badge, SectionHeading } from "@snehavrinda-kala/ui";
import type {
  ApplicationStatus,
  ReviewStatus,
} from "@/lib/partner-onboarding/status";

type StatusResponse = ApplicationStatus & { message: string };

const POLL_INTERVAL_MS = 15_000;
const TERMINAL_STATUSES: ReviewStatus[] = ["approved", "rejected"];

const BADGE_VARIANT: Record<
  ReviewStatus,
  "marigold" | "peacock" | "leaf" | "sindoor"
> = {
  pending: "marigold",
  more_info: "peacock",
  approved: "leaf",
  rejected: "sindoor",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "In review",
  more_info: "More info needed",
  approved: "Approved",
  rejected: "Not approved",
};

const INPUT_CLASS =
  "w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusCard({
  reference,
  onChangeReference,
}: {
  reference: string;
  onChangeReference: (next: string) => void;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const referenceRef = useRef(reference);
  const statusRef = useRef<ReviewStatus | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(
        `/api/store/partner-applications/${encodeURIComponent(referenceRef.current)}`,
        { signal, cache: "no-store" }
      );
      if (signal?.aborted) return;

      if (response.status === 404) {
        statusRef.current = null;
        setData(null);
        setError(
          "We couldn't find an application with that reference. Please check it and try again."
        );
        return;
      }
      if (!response.ok) throw new Error("status lookup failed");

      const json = (await response.json()) as StatusResponse;
      if (signal?.aborted) return;
      statusRef.current = json.review_status;
      setData(json);
      setError(null);
    } catch (err: any) {
      if (signal?.aborted || err?.name === "AbortError") return;
      setError("We couldn't check your application right now. We'll keep trying.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    referenceRef.current = reference;
    statusRef.current = null;
    setLoading(true);
    setData(null);
    setError(null);

    const controller = new AbortController();
    void load(controller.signal);

    const timer = setInterval(() => {
      if (statusRef.current && TERMINAL_STATUSES.includes(statusRef.current)) {
        return;
      }
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [reference, load]);

  function useDifferentReference() {
    onChangeReference("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  if (loading && !data) {
    return (
      <Card elevated>
        <CardContent className="p-8">
          <p className="text-sm text-muted-ink font-sans" role="status">
            Checking your application…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card elevated>
        <CardContent className="p-8">
          <Badge variant="sindoor">Reference not found</Badge>
          <p className="mt-4 text-sm text-muted-ink font-sans" role="alert">
            {error ||
              "We couldn't find an application with that reference."}
          </p>
          <button
            type="button"
            onClick={useDifferentReference}
            className="mt-6 px-5 py-2.5 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
          >
            Try another reference
          </button>
        </CardContent>
      </Card>
    );
  }

  const status = data.review_status;
  const isTerminal = TERMINAL_STATUSES.includes(status);

  return (
    <Card elevated>
      <CardContent className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-ink font-sans">
              Application reference
            </p>
            <p className="mt-1 font-mono text-sm text-deep-ink break-all">
              {data.id}
            </p>
          </div>
          <Badge variant={BADGE_VARIANT[status] ?? "default"}>
            {STATUS_LABEL[status] ?? "Status update"}
          </Badge>
        </div>

        <h2 className="mt-6 font-serif text-2xl font-semibold text-deep-ink">
          {data.display_name}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-ink font-sans">
          {data.message}
        </p>

        <dl className="mt-6 grid gap-4 rounded-lg border border-sand-border bg-surface p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-ink font-sans">
              Submitted
            </dt>
            <dd className="mt-1 text-sm text-deep-ink font-sans">
              {formatDate(data.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-ink font-sans">
              Last reviewed
            </dt>
            <dd className="mt-1 text-sm text-deep-ink font-sans">
              {formatDate(data.reviewed_at)}
            </dd>
          </div>
        </dl>

        {!isTerminal ? (
          <p className="mt-5 text-xs text-muted-ink font-sans" aria-live="polite">
            This page updates automatically while your application is being
            reviewed.
          </p>
        ) : null}

        <button
          type="button"
          onClick={useDifferentReference}
          className="mt-6 text-sm text-sindoor underline underline-offset-2 hover:text-sindoor/80 font-sans"
        >
          Check a different reference
        </button>
      </CardContent>
    </Card>
  );
}

function ReferenceForm({ onSubmit }: { onSubmit: (reference: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = value.trim();
    if (!reference) return;
    onSubmit(reference);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `?application=${encodeURIComponent(reference)}`
      );
    }
  }

  return (
    <Card elevated>
      <CardContent className="p-8">
        <Badge variant="peacock">Check your status</Badge>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-deep-ink">
          Find your application
        </h2>
        <p className="mt-2 text-sm text-muted-ink font-sans">
          Enter the application reference you received when you applied. It
          looks like a long string of letters and numbers.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label htmlFor="application-reference" className="sr-only">
            Application reference
          </label>
          <input
            id="application-reference"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={INPUT_CLASS}
            placeholder="Paste your application reference"
            autoComplete="off"
          />
          <div>
            <button
              type="submit"
              className="px-6 py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              Check status
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusLookup() {
  const searchParams = useSearchParams();
  const paramReference = searchParams.get("application")?.trim() ?? "";
  const [reference, setReference] = useState(paramReference);

  useEffect(() => {
    setReference(paramReference);
  }, [paramReference]);

  if (!reference) {
    return <ReferenceForm onSubmit={setReference} />;
  }

  return <StatusCard reference={reference} onChangeReference={setReference} />;
}

export default function PartnerStatusPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Partner applications"
          title="Check your application status"
          description="Use the reference from your application to see where it stands. This page refreshes itself while our team reviews your details."
        />

        <Suspense
          fallback={
            <Card elevated>
              <CardContent className="p-8">
                <p className="text-sm text-muted-ink font-sans" role="status">
                  Loading…
                </p>
              </CardContent>
            </Card>
          }
        >
          <StatusLookup />
        </Suspense>

        <p className="mt-8 text-sm text-muted-ink font-sans">
          Haven&apos;t applied yet?{" "}
          <Link
            href="/partner/apply"
            className="text-sindoor underline underline-offset-2 hover:text-sindoor/80"
          >
            Apply to partner with us
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
