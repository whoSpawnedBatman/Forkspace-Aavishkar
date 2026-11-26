import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-control border border-control bg-[#13151b] px-3.5 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors focus-visible:border-action-link disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-error",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
