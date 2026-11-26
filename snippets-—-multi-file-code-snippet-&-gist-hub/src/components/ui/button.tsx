import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-[6px] text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--action)] text-white hover:bg-[var(--action-hover)] border border-transparent',
        secondary:
          'bg-[var(--paper)] text-[var(--ink)] border border-[var(--control-border)] hover:bg-[var(--paper-hover)] hover:border-[#b8b8bd]',
        ghost:
          'bg-transparent text-[var(--secondary-text)] hover:text-[var(--ink)] hover:bg-[var(--paper-hover)] border border-transparent',
        destructive:
          'bg-[var(--error-surface)] text-[var(--error-ink)] border border-[var(--error-border)] hover:bg-[#ffe1e5]',
        code:
          'bg-[var(--code-surface-elevated)] text-[var(--code-ink)] border border-[var(--code-border)] hover:bg-[#343438]',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-xs sm:text-[13px]',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
