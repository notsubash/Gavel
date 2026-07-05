import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const legacyShadow = "";

const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-ui border font-sans text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: `border-cta bg-cta text-cta-fg${legacyShadow} hover:bg-cta/90 active:bg-cta/80`,
        secondary: `border-rule-soft bg-card text-ink${legacyShadow} hover:bg-paper-2 active:bg-paper`,
        outline: "border-rule-soft bg-card text-ink hover:bg-paper-2 active:bg-paper",
        ghost: "border-transparent bg-transparent text-ink hover:bg-paper-2 active:bg-paper",
        destructive: `border-fail bg-fail text-cta-fg${legacyShadow} hover:bg-fail/90 active:bg-fail/80`,
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-11 px-3 py-2 text-xs",
        lg: "px-6 py-3 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
