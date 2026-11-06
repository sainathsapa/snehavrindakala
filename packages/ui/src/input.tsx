import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor focus:border-sindoor ${className ?? ""}`}
      {...props}
    />
  );
}
