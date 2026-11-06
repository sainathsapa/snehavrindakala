import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "sindoor"
  | "peacock"
  | "marigold"
  | "haldi"
  | "gulabi"
  | "terracotta"
  | "leaf"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-rang-paper text-deep-ink border border-sand-border",
    sindoor: "bg-sindoor/10 text-sindoor border border-sindoor/20",
    peacock: "bg-peacock/10 text-peacock border border-peacock/20",
    marigold: "bg-marigold/15 text-deep-ink border border-marigold/30",
    haldi: "bg-haldi/15 text-deep-ink border border-haldi/30",
    gulabi: "bg-gulabi/15 text-deep-ink border border-gulabi/30",
    terracotta: "bg-terracotta/15 text-deep-ink border border-terracotta/30",
    leaf: "bg-leaf/15 text-leaf border border-leaf/30",
    outline: "bg-transparent text-muted-ink border border-sand-border",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium font-sans ${variants[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
