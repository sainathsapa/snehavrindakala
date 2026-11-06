import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "madder" | "indigo" | "peacock" | "haldi" | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-paper text-ink border border-border",
    madder: "bg-madder/10 text-madder border border-madder/20",
    indigo: "bg-indigo/10 text-indigo border border-indigo/20",
    peacock: "bg-peacock/10 text-peacock border border-peacock/20",
    haldi: "bg-haldi/15 text-ink border border-haldi/30",
    outline: "bg-transparent text-muted border border-border",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium font-sans ${variants[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
