import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-panel-2 text-foreground ring-border",
        ok: "bg-ok-soft text-ok ring-ok/30",
        warn: "bg-warn-soft text-warn ring-warn/30",
        danger: "bg-danger-soft text-danger ring-danger/30",
        accent: "bg-accent-soft text-accent ring-accent/40",
        muted: "bg-panel-2 text-muted ring-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
