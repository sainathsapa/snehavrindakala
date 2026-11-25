import type { HTMLAttributes } from "react";

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`py-12 md:py-20 ${className ?? ""}`} {...props} />;
}

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className ?? ""}`} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  /**
   * Heading level. Defaults to `h2`, which is right for a section inside a
   * page. A page whose only title is a SectionHeading must pass `"h1"` —
   * /partner/apply and /partner/status shipped with no h1 at all, which leaves
   * screen-reader users without a page title and search engines without a
   * heading to rank.
   */
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={`mb-8 ${className ?? ""}`}>
      {eyebrow && (
        <p className="text-sm font-medium text-muted-ink tracking-wider uppercase font-sans">
          {eyebrow}
        </p>
      )}
      <Heading className="mt-2 text-3xl md:text-4xl font-serif font-semibold text-deep-ink text-balance">
        {title}
      </Heading>
      {description && <p className="mt-3 max-w-2xl text-muted-ink font-sans">{description}</p>}
    </div>
  );
}
