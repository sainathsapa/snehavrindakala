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
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`mb-8 ${className ?? ""}`}>
      {eyebrow && (
        <p className="text-sm font-medium text-madder tracking-wider uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-3xl md:text-4xl font-serif font-semibold text-ink text-balance">
        {title}
      </h2>
      {description && <p className="mt-3 max-w-2xl text-muted font-sans">{description}</p>}
    </div>
  );
}
