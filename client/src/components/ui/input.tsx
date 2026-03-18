import * as React from "react"

import { cn } from "@/lib/utils"

type InputSize = "default" | "lg"

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  size?: InputSize
}

const sizeClasses: Record<InputSize, string> = {
  default:
    "h-9 px-3 py-1 text-base md:text-sm rounded-md",
  lg:
    "min-h-[var(--uix-touch-min)] px-4 py-2 text-[length:var(--uix-text-input)] rounded-lg",
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full border border-input bg-transparent shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
