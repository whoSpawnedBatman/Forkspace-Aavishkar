import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-9 w-full rounded-[6px] bg-[var(--sidebar)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted-text)] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
          invalid
            ? 'border-[var(--error-ink)] bg-[var(--error-surface)]'
            : 'border-[var(--control-border)] hover:border-[#b8b8bd]',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-xs font-medium text-[var(--secondary-text)] leading-snug', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
